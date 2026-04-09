const express = require('express');
const Demand = require('../models/demand.model');
const User = require('../models/user.model');
const AreaConfig = require('../models/area-config.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { broadcastDemandUpdate } = require('../utils/websocket');
const { sendAssignMessages, sendStatusChangeMessages } = require('../utils/msgHelper');
const { canUserAccessDemand } = require('../utils/demand-access');
const { recalculateDemandDurations } = require('../utils/demand-duration');

const router = express.Router();

const TERMINAL_STATUSES = ['已开通', '已驳回'];

/**
 * POST /api/intervene/reassign
 * 重新指派设计/施工/监理单位（网络支撑经理/管理员）
 */
router.post('/intervene/reassign', requireRole('NETWORK_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { demandId, unitType, userId } = req.body;
    // unitType: 'design' | 'construction' | 'supervisor'
    if (!['design', 'construction', 'supervisor'].includes(unitType)) {
      throw createError(400, 'unitType 必须为 design / construction / supervisor');
    }

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (TERMINAL_STATUSES.includes(demand.status)) {
      throw createError(400, '已终态的需求不可重新指派');
    }

    const targetUser = await User.findOne({ _id: userId, active: true });
    if (!targetUser) throw createError(404, '目标用户不存在或已停用');

    const fieldMap = {
      design: { field: 'assignedDesignUnit', role: 'DESIGN', label: '设计单位' },
      construction: { field: 'assignedConstructionUnit', role: 'CONSTRUCTION', label: '施工单位' },
      supervisor: { field: 'assignedSupervisor', role: 'SUPERVISOR', label: '监理单位' }
    };
    const { field, role, label } = fieldMap[unitType];

    if (!targetUser.roles.includes(role)) {
      throw createError(400, `该用户没有 ${label} 角色`);
    }

    demand[field] = userId;

    // 待审核状态指派设计单位时，需要设置 designAssignTime 并变更状态为设计中
    if (unitType === 'design' && demand.status === '待审核') {
      demand.designAssignTime = new Date();
      demand.status = '设计中';
      demand.logs.push({
        content: `设计单位已指派为 ${targetUser.name}，需求进入设计环节`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    } else {
      demand.logs.push({
        content: `${label}已重新指派为 ${targetUser.name}`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    }

    await demand.save();
    logger.info('重新指派', { demandId, unitType, newUser: userId, operator: req.user._id });
    res.json({ code: 0, data: {} });

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    // 异步广播WebSocket通知
    broadcastDemandUpdate(demandId, {
      type: 'reassign',
      demandId,
      demandNo: demand.demandNo,
      status: demand.status,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });

    // 站内消息：通知被指派人
    sendAssignMessages(demand, [targetUser._id]).catch(() => {});
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/intervene/force-status
 * 强制变更需求状态（仅管理员）
 */
router.post('/intervene/force-status', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { demandId, status, reason } = req.body;

    const VALID_STATUSES = ['待审核', '设计中', '施工中', '待确认', '已开通', '已驳回'];
    if (!VALID_STATUSES.includes(status)) {
      throw createError(400, `无效状态值: ${status}`);
    }
    if (!reason || !reason.trim()) {
      throw createError(400, '强制变更必须填写原因');
    }

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');

    const prevStatus = demand.status;
    demand.status = status;
    demand.logs.push({
      content: `管理员强制变更状态: ${prevStatus} → ${status}，原因: ${reason}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });

    await demand.save();
    logger.info('强制变更状态', { demandId, prevStatus, status, operator: req.user._id });
    res.json({ code: 0, data: {} });

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    // 异步广播WebSocket通知
    broadcastDemandUpdate(demandId, {
      type: 'force_status',
      demandId,
      demandNo: demand.demandNo,
      prevStatus,
      status: demand.status,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/intervene/remark
 * 添加备注（所有已认证角色均可）
 */
router.post('/intervene/remark', async (req, res, next) => {
  try {
    const { demandId, content } = req.body;

    if (!content || !content.trim()) throw createError(400, '备注内容不能为空');
    if (content.length > 500) throw createError(400, '备注内容不能超过500字');

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (!await canUserAccessDemand(req.user, demand)) {
      throw createError(403, '无权给此需求添加备注');
    }

    demand.logs.push({
      content: `备注: ${content.trim()}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });

    await demand.save();
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/intervene/confirm
 * 网络支撑经理确认施工完成（待确认 → 已开通）
 * 或驳回施工（待确认 → 施工中）
 */
router.post('/intervene/confirm', requireRole('NETWORK_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { demandId, action, rejectReason } = req.body;
    // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      throw createError(400, 'action 必须为 approve 或 reject');
    }
    if (action === 'reject' && (!rejectReason || !rejectReason.trim())) {
      throw createError(400, '驳回时必须填写原因');
    }

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '待确认') {
      throw createError(400, '只有待确认状态的需求才能确认');
    }

    // ADMIN 无限制；NETWORK_MANAGER 需校验：
    // 必须是 AreaConfig 中该受理区域指定的 networkManagerId，
    // 无 AreaConfig 配置时，允许任意 NETWORK_MANAGER 操作（降级）
    if (!req.user.roles.includes('ADMIN')) {
      const areaConfig = await AreaConfig.findOne({ district: demand.district, acceptArea: demand.acceptArea, active: true }).lean();
      const designatedManagerId = areaConfig ? String(areaConfig.networkManagerId) : null;
      const userId = String(req.user._id);

      const isDesignatedManager = designatedManagerId && designatedManagerId === userId;
      const isNetworkManagerFallback = !areaConfig && req.user.roles.includes('NETWORK_MANAGER');

      if (!isDesignatedManager && !isNetworkManagerFallback) {
        throw createError(403, '您无权确认此需求');
      }
    }

    if (action === 'approve') {
      // 确认开通
      const now = new Date();
      demand.status = '已开通';
      demand.completedTime = now;
      demand.confirmBy = req.user._id;
      demand.confirmTime = now;
      recalculateDemandDurations(demand, now);

      demand.logs.push({
        content: `网络支撑经理 ${req.user.name} 确认施工完成，需求已开通`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
      await demand.save();
      logger.info('网络支撑经理确认开通', { demandId, confirmBy: req.user._id });

      // 异步发送开通通知 + 飞书多维表格同步
      const { notifyDemandCompleted } = require('../utils/notify');
      const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
      notifyDemandCompleted(demand).catch(() => {});
      syncDemandWithPopulate(demand).catch(() => {});
      sendStatusChangeMessages(demand, [demand.createdBy], '已确认开通，感谢您的耐心等待').catch(() => {});
    } else {
      // 驳回施工：重置施工计时，避免重新施工的工单立即超时
      demand.status = '施工中';
      demand.constructionAssignTime = new Date();
      demand.confirmRejectReason = rejectReason;
      // 查询施工单位姓名，写入日志便于追踪
      let constructionStr = '';
      if (demand.assignedConstructionUnit) {
        const constructionUser = await User.findById(demand.assignedConstructionUnit, 'name').lean();
        if (constructionUser?.name) constructionStr = `，退回施工单位：${constructionUser.name}`;
      }
      demand.logs.push({
        content: `网络支撑经理 ${req.user.name} 驳回施工：${rejectReason}${constructionStr}`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
      await demand.save();
      logger.info('网络支撑经理驳回施工', { demandId, rejectBy: req.user._id, reason: rejectReason });

      const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
      syncDemandWithPopulate(demand).catch(() => {});
      sendStatusChangeMessages(demand, [demand.assignedConstructionUnit], '施工验收未通过，请重新施工').catch(() => {});
    }

    res.json({ code: 0, data: { status: demand.status } });

    // 异步广播WebSocket通知
    broadcastDemandUpdate(demandId, {
      type: action === 'approve' ? 'confirm_approve' : 'confirm_reject',
      demandId,
      demandNo: demand.demandNo,
      status: demand.status,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
