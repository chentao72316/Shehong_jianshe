const express = require('express');
const Demand = require('../models/demand.model');
const User = require('../models/user.model');
const Counter = require('../models/counter.model');
const AreaConfig = require('../models/area-config.model');
const RoleConfig = require('../models/role-config.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { notifyNewDemand, notifyRejected, notifyConstructionConfirm } = require('../utils/notify');
const { broadcastDemandUpdate } = require('../utils/websocket');
const { sendAssignMessages, sendStatusChangeMessages, sendRejectMessage } = require('../utils/msgHelper');
const { getDistrictFilter } = require('../utils/district');

const router = express.Router();

/**
 * 转义正则特殊字符，防止用户输入触发 ReDoS
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 解析并约束分页参数
 */
function parsePagination(page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  return { page: p, pageSize: ps };
}

/**
 * 生成连续工单编号：R + YYYYMMDD + 4位当天序号（原子递增，服务端生成）
 */
async function nextDemandNo() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const doc = await Counter.findOneAndUpdate(
    { _id: `demand_${dateStr}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `R${dateStr}${String(doc.seq).padStart(4, '0')}`;
}

/**
 * 根据受理区域配置的候选人列表，返回第一个 active 的用户
 * @param {ObjectId[]} candidates - 候选人 ID 列表
 * @param {object} populatedList - 已 populate 的候选人对象列表
 */
function pickFirstActive(populatedList) {
  return (populatedList || []).find(u => u.active !== false) || null;
}

/**
 * 解析当前用户主角色，返回 visibilityScope
 * 建维中心人员（gridName 含"网络建设中心"）强制 'all'
 */
async function resolveVisibilityScope(user) {
  if (user.gridName && user.gridName.includes('网络建设中心')) return 'all';

  const roles = user.roles || [];
  // 优先级：ADMIN > GRID_MANAGER > NETWORK_MANAGER > LEVEL4_MANAGER > DISTRICT_MANAGER > DEPT_MANAGER > DESIGN/CONSTRUCTION/SUPERVISOR > FRONTLINE
  const PRIORITY = ['ADMIN', 'GRID_MANAGER', 'NETWORK_MANAGER', 'LEVEL4_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR', 'FRONTLINE'];
  const primaryRole = PRIORITY.find(r => roles.includes(r)) || roles[0];
  if (!primaryRole) return 'self';

  const config = await RoleConfig.findOne({ role: primaryRole }).lean();
  return config ? config.visibilityScope : 'self';
}

/**
 * POST /api/demand/create
 */
router.post('/demand/create', async (req, res, next) => {
  try {
    const {
      acceptArea, submitterPhone, demandPersonName, demandPersonPhone,
      demandType, reservedCustomers, dpBoxCount, latitude, longitude,
      locationDetail, photos, urgency, remark,
      businessType, serviceCenter, networkSupport
    } = req.body;
    // demandNo 由服务端生成，忽略客户端传入值
    const demandNo = await nextDemandNo();

    if (!acceptArea || !demandPersonPhone || !businessType || !demandType || !locationDetail) {
      throw createError(400, '缺少必填字段');
    }

    const now = new Date();
    const submitterGridName = req.user.gridName || '';
    // 跨区域判断：提交人有 gridName 且与 acceptArea 不同
    const isCrossArea = !!submitterGridName && acceptArea !== submitterGridName;

    let initialStatus, assignedDesignUnit = null, assignedConstructionUnit = null,
        assignedSupervisor = null, designAssignTime = null, crossAreaReviewerId = null;
    let logContent;

    if (isCrossArea) {
      // 跨区域：找提交人所在网格的 GRID_MANAGER 作为审核人
      const reviewer = await User.findOne({
        gridName: submitterGridName,
        roles: 'GRID_MANAGER',
        active: true
      });
      crossAreaReviewerId = reviewer ? reviewer._id : null;
      initialStatus = '待审核';
      logContent = `跨区域需求已提交（提交网格：${submitterGridName}，受理区域：${acceptArea}）${reviewer ? '，待网格经理 ' + reviewer.name + ' 审核' : '，未找到对应网格经理'}`;
    } else {
      // 同区域：从 AreaConfig 查候选人，取第一个 active
      const areaConfig = await AreaConfig.findOne({ acceptArea, active: true })
        .populate('designCandidates', 'name active')
        .populate('constructionCandidates', 'name active')
        .populate('supervisorCandidates', 'name active')
        .lean();

      if (areaConfig) {
        const designUser = pickFirstActive(areaConfig.designCandidates);
        const constructionUser = pickFirstActive(areaConfig.constructionCandidates);
        const supervisorUser = pickFirstActive(areaConfig.supervisorCandidates);

        assignedDesignUnit = designUser ? designUser._id : null;
        assignedConstructionUnit = constructionUser ? constructionUser._id : null;
        assignedSupervisor = supervisorUser ? supervisorUser._id : null;
        designAssignTime = designUser ? now : null;
        initialStatus = designUser ? '设计中' : '待审核';
        logContent = `需求已录入${designUser ? '，已自动指派设计单位：' + designUser.name : '（未找到匹配的设计单位，待人工指派）'}`;
      } else {
        // 无区域配置，降级查 User 表（兼容旧逻辑）
        const [designUser, constructionUser, supervisorUser] = await Promise.all([
          User.findOne({ area: acceptArea, roles: 'DESIGN', active: true }),
          User.findOne({ area: acceptArea, roles: 'CONSTRUCTION', active: true }),
          User.findOne({ area: acceptArea, roles: 'SUPERVISOR', active: true })
        ]);
        assignedDesignUnit = designUser ? designUser._id : null;
        assignedConstructionUnit = constructionUser ? constructionUser._id : null;
        assignedSupervisor = supervisorUser ? supervisorUser._id : null;
        designAssignTime = designUser ? now : null;
        initialStatus = designUser ? '设计中' : '待审核';
        logContent = `需求已录入${designUser ? '，已自动指派设计单位：' + designUser.name : '（未找到匹配的设计单位，待人工指派）'}`;
      }
    }

    const demand = await Demand.create({
      demandNo,
      acceptArea,
      submitterPhone,
      demandPersonName,
      demandPersonPhone,
      type: demandType,
      reservedCustomers: Number(reservedCustomers),
      dpBoxCount: Number(dpBoxCount),
      latitude,
      longitude,
      locationDetail,
      photos: photos || [],
      urgency: urgency || '普通',
      remark,
      status: initialStatus,
      createdBy: req.user._id,
      gridName: req.user.gridName,
      serviceCenter,
      networkSupport,
      businessType,
      assignedDesignUnit,
      assignedConstructionUnit,
      assignedSupervisor,
      designAssignTime,
      crossAreaReviewerId,
      logs: [{
        content: logContent,
        operatorId: req.user._id,
        operatorName: req.user.name
      }]
    });

    logger.info('需求创建成功', { demandNo: demand.demandNo, createdBy: req.user._id, isCrossArea });
    res.json({ code: 0, data: { id: demand._id, demandNo: demand.demandNo } });

    notifyNewDemand(demand).catch(() => {});

    // 站内消息：指派通知（设计中）或跨区域审核通知
    if (demand.status === '设计中') {
      sendAssignMessages(demand, [demand.assignedDesignUnit, demand.assignedConstructionUnit, demand.assignedSupervisor]).catch(() => {});
    } else if (demand.crossAreaReviewerId) {
      sendAssignMessages(demand, [demand.crossAreaReviewerId]).catch(() => {});
    }

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    broadcastDemandUpdate(String(demand._id), {
      type: 'create',
      demandId: String(demand._id),
      demandNo: demand.demandNo,
      status: demand.status,
      acceptArea: demand.acceptArea,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor,
      createdBy: demand.createdBy,
      createdAt: demand.createdAt
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/demand/update
 * 驳回重提 或 基本信息更新
 */
router.post('/demand/update', async (req, res, next) => {
  try {
    const { id, resubmit, ...updateFields } = req.body;
    if (!id) throw createError(400, '缺少需求ID');
    const demand = await Demand.findById(id);
    if (!demand) throw createError(404, '需求不存在');

    // 权限校验：只有创建人或管理角色可以操作
    const isCreator = String(demand.createdBy) === String(req.user._id);
    const isManager = req.user.roles.some(r => ['GRID_MANAGER', 'NETWORK_MANAGER', 'ADMIN'].includes(r));
    if (!isCreator && !isManager) {
      throw createError(403, '无权修改此需求');
    }

    if (resubmit) {
      if (demand.status !== '已驳回') {
        throw createError(400, '只有已驳回的需求才能重新提交');
      }
      if (!isCreator) throw createError(403, '只有工单创建人才能重新提交');
      // 跨区审核驳回（未进入设计环节）→ 退回待审核重新等待审核
      // 设计阶段驳回 → 直接进入设计中
      const isCrossAreaRejected = demand.crossAreaReviewerId && !demand.assignedDesignUnit;
      const newStatus = isCrossAreaRejected ? '待审核' : '设计中';
      demand.status = newStatus;
      demand.rejectType = null;
      demand.rejectionReason = null;
      demand.rejectionTime = null;
      demand.rejectionAcknowledged = false;
      if (!isCrossAreaRejected) {
        demand.designAssignTime = new Date();
      }
      demand.logs.push({
        content: '需求已重新提交，重新进入设计环节',
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    } else {
      // 非重提：字段白名单，防止越权修改状态等敏感字段
      const ALLOWED_FIELDS = [
        'demandPersonName', 'demandPersonPhone', 'submitterPhone',
        'locationDetail', 'latitude', 'longitude',
        'urgency', 'remark', 'demandType'
      ];
      const filteredFields = {};
      ALLOWED_FIELDS.forEach(k => {
        if (updateFields[k] !== undefined) filteredFields[k] = updateFields[k];
      });
      Object.assign(demand, {
        ...filteredFields,
        type: filteredFields.demandType || demand.type
      });
      demand.logs.push({
        content: '需求信息已更新',
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    }

    await demand.save();
    res.json({ code: 0, data: { id: demand._id } });

    // 站内消息：重提后通知审核人或设计单位继续处理
    if (resubmit) {
      const notifyId = demand.crossAreaReviewerId || demand.assignedDesignUnit;
      sendStatusChangeMessages(demand, [notifyId], '已重新提交，请继续处理').catch(() => {});
    }

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/demand/list
 */
router.get('/demand/list', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, status, type, keyword, area, dateFrom, dateTo } = req.query;
    const { page: p, pageSize: ps } = parsePagination(page, pageSize);
    const query = {};

    // 获取可见范围
    const scope = await resolveVisibilityScope(req.user);

    switch (scope) {
      case 'all':
        // 无过滤；ADMIN 按 district 隔离
        Object.assign(query, getDistrictFilter(req));
        if (area) query.acceptArea = area;
        break;
      case 'area':
        query.acceptArea = req.user.area;
        break;
      case 'grid':
        // 网格经理：看自己网格提交的工单 + 受理区域在自己网格的跨区域工单
        query.$or = [
          { gridName: req.user.gridName },
          { acceptArea: req.user.gridName }
        ];
        break;
      case 'self':
        query.createdBy = req.user._id;
        break;
      case 'assigned': {
        // 按具体角色确定指派字段，不强制 status（由前端筛选器控制）
        const roles = req.user.roles || [];
        if (roles.includes('DESIGN')) {
          query.assignedDesignUnit = req.user._id;
        } else if (roles.includes('CONSTRUCTION')) {
          query.assignedConstructionUnit = req.user._id;
        } else if (roles.includes('SUPERVISOR')) {
          query.assignedSupervisor = req.user._id;
        } else {
          query.createdBy = req.user._id;
        }
        break;
      }
      default:
        query.createdBy = req.user._id;
    }

    // 支持多种 status 格式：
    // 1. 普通字符串: "待审核"
    // 2. 逗号分隔: "待审核,设计中"
    // 3. JSON 字符串数组: "[\"待审核\"]" 或 "[\"待审核\",\"施工中\"]"
    // 4. 实际数组: ["待审核"]
    // 忽略 undefined/null/空串/"undefined"/"null"
    if (status) {
      let statusArr = [];
      if (Array.isArray(status)) {
        statusArr = status.filter(s => s && String(s).trim() !== '' && s !== 'undefined' && s !== 'null');
      } else if (typeof status === 'string' && status.trim() !== '' && status !== 'undefined' && status !== 'null') {
        // 如果是 JSON 数组字符串格式 "[\"...\"]"，先尝试解析
        const trimmed = status.trim();
        if (trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              statusArr = parsed.map(s => String(s)).filter(s => s && s.trim() !== '' && s !== 'undefined' && s !== 'null');
            }
          } catch {
            // 不是 JSON，按逗号分隔处理
            statusArr = trimmed.includes(',') ? trimmed.split(',').map(s => s.trim()).filter(Boolean) : [trimmed];
          }
        } else {
          statusArr = trimmed.includes(',') ? trimmed.split(',').map(s => s.trim()).filter(Boolean) : [trimmed];
        }
      }
      if (statusArr.length > 0) {
        query.status = { $in: statusArr };
      }
    }
    if (type) query.type = type;

    // 创建时间区间过滤
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // keyword 搜索（工单编号 / 申请人姓名 / 位置）
    if (keyword) {
      const safeKeyword = escapeRegex(keyword);
      const kwFilter = {
        $or: [
          { demandNo: { $regex: safeKeyword, $options: 'i' } },
          { demandPersonName: { $regex: safeKeyword, $options: 'i' } },
          { locationDetail: { $regex: safeKeyword, $options: 'i' } }
        ]
      };
      if (query.$or) {
        query.$and = [{ $or: query.$or }, kwFilter];
        delete query.$or;
      } else {
        Object.assign(query, kwFilter);
      }
    }

    const [list, total] = await Promise.all([
      Demand.find(query)
        .sort({ createdAt: -1 })
        .skip((p - 1) * ps)
        .limit(ps)
        .populate('assignedDesignUnit', 'name phone')
        .populate('assignedConstructionUnit', 'name phone')
        .populate('assignedSupervisor', 'name phone')
        .populate('createdBy', 'name phone')
        .lean(),
      Demand.countDocuments(query)
    ]);

    // 统计概览（首页用，仅第一页）
    let stats = null;
    if (p === 1) {
      const { status: _s, type: _t, ...entityFilter } = query;
      // 超时：设计中超2天 或 施工中超5天
      const designTimeoutCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const constructionTimeoutCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const timeoutOr = [
        { status: '设计中', designAssignTime: { $lte: designTimeoutCutoff } },
        { status: '施工中', constructionAssignTime: { $lte: constructionTimeoutCutoff } }
      ];
      let timeoutFilter;
      if (entityFilter.$or) {
        const { $or: existingOr, ...restFilter } = entityFilter;
        timeoutFilter = { ...restFilter, $and: [{ $or: existingOr }, { $or: timeoutOr }] };
      } else {
        timeoutFilter = { ...entityFilter, $or: timeoutOr };
      }
      const [statsTotal, pending, designing, constructing, waitingConfirm, done, timeout] = await Promise.all([
        Demand.countDocuments(entityFilter),
        Demand.countDocuments({ ...entityFilter, status: '待审核' }),
        Demand.countDocuments({ ...entityFilter, status: '设计中' }),
        Demand.countDocuments({ ...entityFilter, status: '施工中' }),
        Demand.countDocuments({ ...entityFilter, status: '待确认' }),
        Demand.countDocuments({ ...entityFilter, status: '已开通' }),
        Demand.countDocuments(timeoutFilter)
      ]);
      stats = { total: statsTotal, pending, designing, constructing, waitingConfirm, inProgress: pending + designing + constructing, done, timeout };
    }

    const mappedList = list.map(item => ({ ...item, id: String(item._id) }));
    res.json({ code: 0, data: { list: mappedList, total, stats } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/demand/detail
 */
router.get('/demand/detail', async (req, res, next) => {
  try {
    const { id } = req.query;
    if (!id) throw createError(400, '缺少id参数');
    const demand = await Demand.findById(id)
      .populate('assignedDesignUnit', 'name phone')
      .populate('assignedConstructionUnit', 'name phone')
      .populate('assignedSupervisor', 'name phone')
      .populate('createdBy', 'name phone')
      .populate('crossAreaReviewerId', 'name phone')
      .lean();
    if (!demand) throw createError(404, '需求不存在');

    // 数据权限校验：与 list 接口保持一致，防止越权查看
    const scope = await resolveVisibilityScope(req.user);
    if (scope !== 'all') {
      const userId = String(req.user._id);
      const roles = req.user.roles || [];
      let hasAccess = false;
      const creatorId = String(demand.createdBy?._id || demand.createdBy || '');

      switch (scope) {
        case 'area':
          hasAccess = demand.acceptArea === req.user.area;
          break;
        case 'grid':
          hasAccess = demand.gridName === req.user.gridName || demand.acceptArea === req.user.gridName;
          break;
        case 'self':
          hasAccess = creatorId === userId;
          break;
        case 'assigned': {
          const designId = String(demand.assignedDesignUnit?._id || demand.assignedDesignUnit || '');
          const constructionId = String(demand.assignedConstructionUnit?._id || demand.assignedConstructionUnit || '');
          const supervisorId = String(demand.assignedSupervisor?._id || demand.assignedSupervisor || '');
          if (roles.includes('DESIGN')) hasAccess = designId === userId;
          else if (roles.includes('CONSTRUCTION')) hasAccess = constructionId === userId;
          else if (roles.includes('SUPERVISOR')) hasAccess = supervisorId === userId;
          else hasAccess = creatorId === userId;
          // 创建人本人也可查看
          if (!hasAccess) hasAccess = creatorId === userId;
          break;
        }
        default:
          hasAccess = creatorId === userId;
      }
      if (!hasAccess) throw createError(403, '无权访问此需求');
    }

    res.json({ code: 0, data: demand });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/demand/:id
 * 删除工单（仅管理员）
 */
router.delete('/demand/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const demand = await Demand.findByIdAndDelete(req.params.id);
    if (!demand) throw createError(404, '工单不存在');
    logger.info('管理员删除工单', { demandId: req.params.id, demandNo: demand.demandNo, operator: req.user._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/demand/reject
 * 驳回需求（设计单位在设计环节驳回）
 */
router.post('/demand/reject', async (req, res, next) => {
  try {
    const { demandId, reason, rejectType } = req.body;
    if (!reason || !reason.trim()) throw createError(400, '驳回原因不能为空');
    if (rejectType && !['有资源', '其他'].includes(rejectType)) {
      throw createError(400, 'rejectType 必须为"有资源"或"其他"');
    }

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '设计中') {
      throw createError(400, '当前状态不允许驳回');
    }
    if (String(demand.assignedDesignUnit) !== String(req.user._id) &&
        !req.user.roles.some(r => ['GRID_MANAGER', 'NETWORK_MANAGER', 'ADMIN'].includes(r))) {
      throw createError(403, '无权驳回此需求');
    }

    demand.status = '已驳回';
    demand.rejectType = rejectType || '其他';
    demand.rejectionReason = reason;
    demand.rejectionTime = new Date();
    demand.rejectedBy = req.user._id;
    demand.rejectCount = (demand.rejectCount || 0) + 1;
    demand.logs.push({
      content: `需求被驳回[${demand.rejectType}]：${reason}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });
    await demand.save();

    logger.info('需求已驳回', { demandId, reason, rejectType, rejectedBy: req.user._id });
    res.json({ code: 0, data: { rejectCount: demand.rejectCount } });

    notifyRejected(demand, req.user.name).catch(() => {});
    sendRejectMessage(demand, demand.rejectionReason).catch(() => {});
    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});
    broadcastDemandUpdate(demandId, {
      type: 'reject',
      demandId,
      demandNo: demand.demandNo,
      status: demand.status,
      rejectType,
      rejectionReason: reason,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/demand/acknowledge-rejection
 * 提交人确认驳回（工单从待办列表消失，不再重新提交）
 */
router.post('/demand/acknowledge-rejection', async (req, res, next) => {
  try {
    const { demandId } = req.body;
    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '已驳回') throw createError(400, '只有已驳回的工单才能确认驳回');
    if (String(demand.createdBy) !== String(req.user._id) &&
        !req.user.roles.includes('ADMIN')) {
      throw createError(403, '只有工单提交人才能确认驳回');
    }
    demand.rejectionAcknowledged = true;
    demand.logs.push({
      content: '提交人已确认驳回，工单终止',
      operatorId: req.user._id,
      operatorName: req.user.name
    });
    await demand.save();
    logger.info('提交人确认驳回', { demandId, operator: req.user._id });
    res.json({ code: 0, data: {} });

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/demand/cross-area-review
 * 跨区域工单审核（网格经理审核待审核状态的跨区域工单）
 */
router.post('/demand/cross-area-review', requireRole('GRID_MANAGER'), async (req, res, next) => {
  try {
    const { demandId, approve, note } = req.body;
    if (typeof approve !== 'boolean') throw createError(400, 'approve 必须为布尔值');
    if (!approve && (!note || !note.trim())) throw createError(400, '驳回时必须填写原因');

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '待审核') throw createError(400, '只有待审核状态的工单才能审核');
    if (String(demand.crossAreaReviewerId) !== String(req.user._id)) {
      throw createError(403, '您不是该工单的指定审核人');
    }

    demand.crossAreaApproveNote = note || '';

    if (approve) {
      // 审核通过：查 AreaConfig 指派设计候选人
      const areaConfig = await AreaConfig.findOne({ acceptArea: demand.acceptArea, active: true })
        .populate('designCandidates', 'name active')
        .populate('constructionCandidates', 'name active')
        .populate('supervisorCandidates', 'name active')
        .lean();

      let designUser = null, constructionUser = null, supervisorUser = null;
      if (areaConfig) {
        designUser = pickFirstActive(areaConfig.designCandidates);
        constructionUser = pickFirstActive(areaConfig.constructionCandidates);
        supervisorUser = pickFirstActive(areaConfig.supervisorCandidates);
      } else {
        // 降级：按 area 字段查
        [designUser, constructionUser, supervisorUser] = await Promise.all([
          User.findOne({ area: demand.acceptArea, roles: 'DESIGN', active: true }),
          User.findOne({ area: demand.acceptArea, roles: 'CONSTRUCTION', active: true }),
          User.findOne({ area: demand.acceptArea, roles: 'SUPERVISOR', active: true })
        ]);
      }

      demand.assignedDesignUnit = designUser ? designUser._id : null;
      demand.assignedConstructionUnit = constructionUser ? constructionUser._id : null;
      demand.assignedSupervisor = supervisorUser ? supervisorUser._id : null;
      demand.designAssignTime = designUser ? new Date() : null;
      // 找到设计人则进入设计中；否则清空 crossAreaReviewerId 让管理员重新指派
      if (designUser) {
        demand.status = '设计中';
      } else {
        demand.status = '待审核';
        demand.crossAreaReviewerId = null; // 清空，避免旧审核人被锁定
      }

      demand.logs.push({
        content: `跨区域审核通过（审核人：${req.user.name}）${
          designUser ? '，已指派设计单位：' + designUser.name : '，未找到设计候选人，已通知管理员手动指派'
        }${
          constructionUser ? '，施工单位：' + constructionUser.name : ''
        }${
          supervisorUser ? '，监理：' + supervisorUser.name : ''
        }`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    } else {
      demand.status = '已驳回';
      demand.rejectionReason = note;
      demand.rejectionTime = new Date();
      demand.rejectedBy = req.user._id;
      demand.rejectCount = (demand.rejectCount || 0) + 1;
      demand.logs.push({
        content: `跨区域审核驳回（审核人：${req.user.name}）：${note}`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    }

    await demand.save();
    logger.info('跨区域审核', { demandId, approve, reviewer: req.user._id });
    res.json({ code: 0, data: { status: demand.status } });

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});
    broadcastDemandUpdate(demandId, {
      type: approve ? 'cross_area_approve' : 'cross_area_reject',
      demandId,
      demandNo: demand.demandNo,
      status: demand.status,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });

    // 站内消息
    if (approve && demand.status === '设计中') {
      sendAssignMessages(demand, [demand.assignedDesignUnit, demand.assignedConstructionUnit, demand.assignedSupervisor]).catch(() => {});
    } else if (!approve) {
      sendRejectMessage(demand, demand.rejectionReason).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/demand/pending
 * 首页待办列表（按角色返回，管理角色返回超时工单）
 */
router.get('/demand/pending', async (req, res, next) => {
  try {
    const scope = await resolveVisibilityScope(req.user);
    const roles = req.user.roles || [];
    const PRIORITY = ['ADMIN', 'GRID_MANAGER', 'NETWORK_MANAGER', 'LEVEL4_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR', 'FRONTLINE'];
    const primaryRole = PRIORITY.find(r => roles.includes(r)) || roles[0] || 'FRONTLINE';

    // 构建基础实体范围过滤（与 list 路由一致）
    const entityFilter = {};
    switch (scope) {
      case 'all':
        break;
      case 'area':
        entityFilter.acceptArea = req.user.area;
        break;
      case 'grid':
        entityFilter.$or = [
          { gridName: req.user.gridName },
          { acceptArea: req.user.gridName }
        ];
        break;
      case 'self':
        entityFilter.createdBy = req.user._id;
        break;
      case 'assigned':
        if (roles.includes('DESIGN')) {
          entityFilter.assignedDesignUnit = req.user._id;
        } else if (roles.includes('CONSTRUCTION')) {
          entityFilter.assignedConstructionUnit = req.user._id;
        } else if (roles.includes('SUPERVISOR')) {
          entityFilter.assignedSupervisor = req.user._id;
        } else {
          entityFilter.createdBy = req.user._id;
        }
        break;
      default:
        entityFilter.createdBy = req.user._id;
    }

    const MANAGEMENT_ROLES = ['DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'ADMIN'];
    let query;

    if (MANAGEMENT_ROLES.includes(primaryRole)) {
      // 管理角色：返回超时工单（设计超2天 / 施工超5天）
      const designTimeoutCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const constructionTimeoutCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const timeoutOr = [
        { status: '设计中', designAssignTime: { $lte: designTimeoutCutoff } },
        { status: '施工中', constructionAssignTime: { $lte: constructionTimeoutCutoff } }
      ];
      if (entityFilter.$or) {
        const { $or: existingOr, ...restFilter } = entityFilter;
        query = { ...restFilter, $and: [{ $or: existingOr }, { $or: timeoutOr }] };
      } else {
        query = { ...entityFilter, $or: timeoutOr };
      }
    } else {
      const statusFilterMap = {
        FRONTLINE:       ['待审核', '设计中', '施工中', '待确认', '已驳回'],
        DESIGN:          ['设计中'],
        CONSTRUCTION:    ['施工中'],
        SUPERVISOR:      ['待审核', '设计中', '施工中', '待确认', '已开通'],
        GRID_MANAGER:    ['待审核'],
        NETWORK_MANAGER: ['待审核', '待确认'],
      };
      const statuses = statusFilterMap[primaryRole] || ['待审核', '设计中', '施工中', '待确认'];
      // FRONTLINE 已驳回工单中已确认的不再出现在待办列表
      const extraFilter = primaryRole === 'FRONTLINE' ? { rejectionAcknowledged: { $ne: true } } : {};
      query = { ...entityFilter, status: { $in: statuses }, ...extraFilter };
    }

    const list = await Demand.find(query)
      .sort({ createdAt: 1 })
      .limit(5)
      .populate('assignedDesignUnit', 'name phone')
      .populate('assignedConstructionUnit', 'name phone')
      .populate('assignedSupervisor', 'name phone')
      .populate('createdBy', 'name phone')
      .lean();

    const now = Date.now();
    const mappedList = list.map(item => {
      let timeoutDays = null;
      let remainingDays = null;
      if (item.status === '设计中' && item.designAssignTime) {
        const elapsed = Math.floor((now - new Date(item.designAssignTime)) / 86400000);
        remainingDays = 2 - elapsed;
        timeoutDays = elapsed > 2 ? elapsed - 2 : null;
      } else if (item.status === '施工中' && item.constructionAssignTime) {
        const elapsed = Math.floor((now - new Date(item.constructionAssignTime)) / 86400000);
        remainingDays = 5 - elapsed;
        timeoutDays = elapsed > 5 ? elapsed - 5 : null;
      }
      return { ...item, id: String(item._id), timeoutDays, remainingDays };
    });

    res.json({ code: 0, data: { list: mappedList } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
