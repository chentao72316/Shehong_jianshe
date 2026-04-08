const express = require('express');
const Demand = require('../models/demand.model');
const User = require('../models/user.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { sendTimeoutRemind } = require('../utils/feishu');
const { sendRemindMessage } = require('../utils/msgHelper');
const { logger } = require('../utils/logger');
const { getDistrictFilter } = require('../utils/district');

const router = express.Router();

const DESIGN_TIMEOUT_MS       = 2 * 24 * 60 * 60 * 1000;
const CONSTRUCTION_TIMEOUT_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * GET /api/timeout/list
 * 获取超时需求列表（支持 area 过滤，返回 timeoutDays 和 timeoutType）
 */
router.get('/timeout/list', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, area } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const now = new Date();
    const designTimeoutCutoff       = new Date(now.getTime() - DESIGN_TIMEOUT_MS);
    const constructionTimeoutCutoff = new Date(now.getTime() - CONSTRUCTION_TIMEOUT_MS);

    // 基础条件：在设计/施工中且已超时
    const conditions = [
      {
        $or: [
          { status: '设计中', designAssignTime: { $lte: designTimeoutCutoff } },
          { status: '施工中', constructionAssignTime: { $lte: constructionTimeoutCutoff } }
        ]
      }
    ];

    // 区县过滤
    const districtFilter = getDistrictFilter(req);
    if (Object.keys(districtFilter).length) conditions.push(districtFilter);

    // 角色范围限制
    const roles = req.user.roles || [];
    if (roles.includes('ADMIN') || roles.includes('DISTRICT_MANAGER')) {
      // 全量可见
    } else if (req.user.gridName && req.user.gridName.includes('网络建设中心')) {
      // 建维中心人员全量可见
    } else if (roles.includes('NETWORK_MANAGER')) {
      conditions.push({ acceptArea: req.user.area });
    } else if (roles.includes('GRID_MANAGER') || roles.includes('DEPT_MANAGER') || roles.includes('LEVEL4_MANAGER')) {
      conditions.push({ $or: [{ gridName: req.user.gridName }, { acceptArea: req.user.gridName }] });
    }

    // 用户指定的区域过滤
    if (area) {
      conditions.push({ acceptArea: area });
    }

    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

    const [total, rawList] = await Promise.all([
      Demand.countDocuments(query),
      Demand.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(Number(pageSize))
        .select('demandNo acceptArea gridName type urgency status demandPersonName designAssignTime constructionAssignTime assignedDesignUnit assignedConstructionUnit')
        .populate('assignedDesignUnit', 'name phone')
        .populate('assignedConstructionUnit', 'name phone')
        .lean()
    ]);

    // 计算每条记录的超时天数和超时类型
    const list = rawList.map(demand => {
      let timeoutDays = 0;
      let timeoutType = '';
      if (demand.status === '设计中' && demand.designAssignTime) {
        timeoutDays = Math.max(0, Math.floor((now - new Date(demand.designAssignTime)) / (24 * 60 * 60 * 1000)) - 2);
        timeoutType = '设计超时';
      } else if (demand.status === '施工中' && demand.constructionAssignTime) {
        timeoutDays = Math.max(0, Math.floor((now - new Date(demand.constructionAssignTime)) / (24 * 60 * 60 * 1000)) - 5);
        timeoutType = '施工超时';
      }
      return { ...demand, id: demand._id, timeoutDays, timeoutType };
    });

    res.json({ code: 0, data: { total, list } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/timeout/remind
 * 发送飞书超时提醒
 */
router.post('/timeout/remind', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { demandId } = req.body;

    const demand = await Demand.findById(demandId)
      .populate('assignedDesignUnit', 'name feishuId')
      .populate('assignedConstructionUnit', 'name feishuId');
    if (!demand) throw createError(404, '需求不存在');

    let targetUser = null;
    if (demand.status === '设计中') {
      targetUser = demand.assignedDesignUnit;
    } else if (demand.status === '施工中') {
      targetUser = demand.assignedConstructionUnit;
    }

    if (!targetUser) {
      throw createError(400, '当前状态无对应责任人可提醒');
    }
    if (!targetUser.feishuId) {
      throw createError(400, '该责任人未配置飞书ID，无法发送提醒');
    }

    await sendTimeoutRemind(demand, targetUser);
    sendRemindMessage(demand, targetUser._id, req.user.name).catch(() => {});

    demand.logs.push({
      content: `已发送飞书超时提醒至 ${targetUser.name}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });
    await demand.save();

    logger.info('飞书超时提醒已发送', { demandId, targetUser: targetUser._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
