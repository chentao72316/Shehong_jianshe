const express = require('express');
const Demand = require('../models/demand.model');
const User = require('../models/user.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { sendTimeoutRemind } = require('../utils/feishu');
const { sendRemindMessage } = require('../utils/msgHelper');
const { notifyTimeoutEvent } = require('../utils/notify');
const { logger } = require('../utils/logger');
const { getDistrictFilter } = require('../utils/district');
const { buildNetworkManagerDemandFilter } = require('../utils/network-manager-scope');
const { getTimeoutConfig, getDemandTimeoutEvents, EVENT_META, DAY_MS } = require('../utils/timeout-policy');

const router = express.Router();

/**
 * GET /api/timeout/list
 * 获取超时需求列表（支持 area 过滤，返回 timeoutDays 和 timeoutType）
 */
router.get('/timeout/list', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, area, timeoutType } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const now = new Date();
    const cfg = await getTimeoutConfig();

    const conditions = [{ status: { $in: ['设计中', '施工中', '待审核', '待确认'] } }];

    // 区县过滤
    const districtFilter = getDistrictFilter(req);
    if (Object.keys(districtFilter).length) conditions.push(districtFilter);

    // 角色范围限制
    const roles = req.user.roles || [];
    if (roles.includes('ADMIN') || roles.includes('DISTRICT_MANAGER') || roles.includes('LEVEL4_MANAGER')) {
      // 全量可见
    } else if (req.user.gridName && req.user.gridName.includes('网络建设中心')) {
      // 建维中心人员全量可见
    } else if (roles.includes('NETWORK_MANAGER')) {
      conditions.push(await buildNetworkManagerDemandFilter(req.user));
    } else if (roles.includes('GRID_MANAGER') || roles.includes('DEPT_MANAGER')) {
      conditions.push({ $or: [{ gridName: req.user.gridName }, { acceptArea: req.user.gridName }] });
    }

    // 用户指定的区域过滤
    if (area) {
      conditions.push({ acceptArea: area });
    }

    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];

    const rawList = await Demand.find(query)
      .sort({ updatedAt: -1 })
      .select('demandNo acceptArea gridName type urgency status demandPersonName designAssignTime constructionAssignTime confirmPendingTime createdAt updatedAt assignedDesignUnit assignedConstructionUnit assignedSupervisor crossAreaReviewerId assignedDesignUnits assignedConstructionUnits assignedSupervisors autoReminderMutedTypes autoReminderMutedAll')
      .populate('assignedDesignUnit', 'name phone feishuId')
      .populate('assignedConstructionUnit', 'name phone feishuId')
      .populate('assignedSupervisor', 'name phone feishuId')
      .populate('crossAreaReviewerId', 'name phone feishuId')
      .lean();

    const rows = [];
    for (const demand of rawList) {
      const events = getDemandTimeoutEvents(demand, cfg, now)
        .filter((event) => event.severity === 'timeout')
        .filter((event) => !timeoutType || event.type === timeoutType);

      for (const event of events) {
        rows.push({
          ...demand,
          id: demand._id,
          timeoutEventType: event.type,
          timeoutType: event.timeoutType,
          timeoutDays: Math.max(0, Math.floor((event.elapsedMs - event.timeoutDays * DAY_MS) / DAY_MS)),
          timeoutHours: Math.max(0, Math.floor((event.elapsedMs - event.timeoutDays * DAY_MS) / (60 * 60 * 1000))),
          timeoutStartTime: event.startTime,
          muted: Boolean(demand.autoReminderMutedAll || (demand.autoReminderMutedTypes || []).includes(event.type))
        });
      }
    }

    const total = rows.length;
    const list = rows.slice(skip, skip + Number(pageSize));
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
    const { demandId, eventType } = req.body;

    const demand = await Demand.findById(demandId)
      .populate('assignedDesignUnit', 'name feishuId')
      .populate('assignedDesignUnits', 'name feishuId')
      .populate('assignedConstructionUnit', 'name feishuId')
      .populate('assignedConstructionUnits', 'name feishuId')
      .populate('assignedSupervisor', 'name feishuId')
      .populate('assignedSupervisors', 'name feishuId')
      .populate('crossAreaReviewerId', 'name feishuId');
    if (!demand) throw createError(404, '需求不存在');

    let targetUser = null;
    if (demand.status === '设计中') {
      targetUser = demand.assignedDesignUnit;
    } else if (demand.status === '施工中') {
      targetUser = demand.assignedConstructionUnit;
    }

    if (eventType && EVENT_META[eventType] && !['designTimeout', 'constructionTimeout'].includes(eventType)) {
      const cfg = await getTimeoutConfig();
      const event = getDemandTimeoutEvents(demand, cfg, new Date()).find((item) => item.type === eventType);
      if (!event) throw createError(400, '当前工单未触发该自动督办类型');
      await notifyTimeoutEvent(demand, event);
    } else {
      if (!targetUser) {
        throw createError(400, '当前状态无对应责任人可提醒');
      }
      if (!targetUser.feishuId) {
        throw createError(400, '该责任人未配置飞书ID，无法发送提醒');
      }
      await sendTimeoutRemind(demand, targetUser);
      sendRemindMessage(demand, targetUser._id, req.user.name).catch(() => {});
    }

    demand.logs.push({
      content: `已发送飞书超时提醒${targetUser ? `至 ${targetUser.name}` : ''}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });
    await demand.save();

    logger.info('飞书超时提醒已发送', { demandId, eventType: eventType || null, targetUser: targetUser?._id || null });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

router.post('/timeout/mute', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { demandId, eventType, muted = true, reason = '' } = req.body;
    if (!demandId) throw createError(400, '缺少需求ID');
    if (eventType && !EVENT_META[eventType]) throw createError(400, '未知的自动督办类型');

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');

    const types = new Set(demand.autoReminderMutedTypes || []);
    if (eventType) {
      if (muted) types.add(eventType);
      else types.delete(eventType);
      demand.autoReminderMutedTypes = [...types];
    } else {
      demand.autoReminderMutedAll = Boolean(muted);
    }

    demand.autoReminderMutedBy = req.user._id;
    demand.autoReminderMutedAt = new Date();
    demand.autoReminderMuteReason = reason || '';
    demand.logs.push({
      content: `${muted ? '停止' : '恢复'}系统自动督办${eventType ? `：${EVENT_META[eventType].label}` : '：全部类型'}${reason ? `，原因：${reason}` : ''}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });
    await demand.save();

    logger.info('自动督办静默设置更新', { demandId, eventType: eventType || 'ALL', muted, operatorId: req.user._id });
    res.json({ code: 0, data: { muted, eventType: eventType || null } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
