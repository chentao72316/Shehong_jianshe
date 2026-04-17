const Demand = require('../models/demand.model');
const { logger } = require('../utils/logger');
const { notifyTimeoutEvent } = require('../utils/notify');
const { getTimeoutConfig, getDemandTimeoutEvents } = require('../utils/timeout-policy');
const {
  getAutoReminderConfig,
  zonedDateKey,
  findSendBatch,
  getDailyState,
  msUntilNextCheck
} = require('../utils/auto-reminder-policy');

const AUTO_REMINDER_STATUSES = ['设计中', '施工中', '待审核', '待确认'];
let schedulerTimer = null;
let schedulerRunning = false;

function ensureReminderState(demand) {
  const current = demand.autoReminderState;
  if (current && typeof current === 'object' && !Array.isArray(current)) return current;
  demand.autoReminderState = {};
  return demand.autoReminderState;
}

function isMuted(demand, eventType) {
  if (demand.autoReminderMutedAll) return true;
  return (demand.autoReminderMutedTypes || []).includes(eventType);
}

function shouldSendAutoReminder(demand, event, now, reminderCfg) {
  if (isMuted(demand, event.type)) return false;
  const state = ensureReminderState(demand);
  const eventState = state[event.type] || {};
  const batch = findSendBatch(now, reminderCfg, demand, event);
  const today = zonedDateKey(now, reminderCfg);
  const dailyState = getDailyState(state, today);

  eventState.firstDetectedAt = eventState.firstDetectedAt || now;
  eventState.lastDetectedAt = now;
  eventState.lastSeverity = event.severity;
  eventState.status = 'active';
  state[event.type] = eventState;

  if (!batch) return false;
  if (eventState.lastSentSlot === batch.slot) return false;

  const eventSendCount = dailyState.eventSendCounts[event.type] || 0;
  if (dailyState.demandSendCount >= reminderCfg.maxSendsPerDemandPerDay) return false;
  if (eventSendCount >= reminderCfg.maxSendsPerEventPerDay) return false;

  eventState.lastSentAt = now;
  eventState.lastSentSlot = batch.slot;
  eventState.lastSentBatch = batch.label;
  dailyState.demandSendCount += 1;
  dailyState.eventSendCounts[event.type] = eventSendCount + 1;

  return true;
}

function closeResolvedEvents(demand, activeTypes, now) {
  const state = ensureReminderState(demand);
  let changed = false;
  Object.keys(state).forEach((type) => {
    if (!activeTypes.has(type) && state[type]?.status !== 'resolved') {
      state[type] = {
        ...state[type],
        status: 'resolved',
        resolvedAt: now
      };
      changed = true;
    } else if (activeTypes.has(type)) {
      if (state[type]?.status !== 'active') {
        state[type] = {
          ...state[type],
          status: 'active'
        };
        changed = true;
      }
    }
  });
  return changed;
}

async function runTimeoutCheck() {
  const now = new Date();
  let detected = 0;
  let sent = 0;

  try {
    const cfg = await getTimeoutConfig();
    const reminderCfg = await getAutoReminderConfig();
    const demands = await Demand.find({
      status: { $in: AUTO_REMINDER_STATUSES }
    })
      .populate('assignedDesignUnit', 'name feishuId')
      .populate('assignedDesignUnits', 'name feishuId')
      .populate('assignedConstructionUnit', 'name feishuId')
      .populate('assignedConstructionUnits', 'name feishuId')
      .populate('assignedSupervisor', 'name feishuId')
      .populate('assignedSupervisors', 'name feishuId')
      .populate('crossAreaReviewerId', 'name feishuId');

    for (const demand of demands) {
      let changed = false;
      if (demand.status === '待确认' && !demand.confirmPendingTime) {
        demand.confirmPendingTime = demand.updatedAt || demand.createdAt || now;
        changed = true;
      }
      const events = getDemandTimeoutEvents(demand, cfg, now);
      const activeTypes = new Set(events.map((event) => event.type));

      changed = closeResolvedEvents(demand, activeTypes, now) || changed;
      detected += events.length;

      for (const event of events) {
        if (shouldSendAutoReminder(demand, event, now, reminderCfg)) {
          notifyTimeoutEvent(demand, event).catch((err) =>
            logger.error('自动超时事件通知失败', { demandId: demand._id, eventType: event.type, error: err.message })
          );
          sent++;
          demand.logs.push({
            content: `系统自动督办：${event.label}`,
            operatorId: null,
            operatorName: '系统'
          });
          changed = true;
        }
        changed = true;
      }

      if (changed || events.length) {
        demand.markModified('autoReminderState');
        await demand.save();
      }
    }

    logger.info('自动超时检查完成', {
      detected,
      sent,
      timezone: reminderCfg.timezone,
      businessDate: zonedDateKey(now, reminderCfg)
    });
  } catch (err) {
    logger.error('自动超时检查异常', { error: err.message });
  }
}

async function scheduleNextTimeoutCheck() {
  const reminderCfg = await getAutoReminderConfig().catch((err) => {
    logger.error('自动督办配置读取失败，使用默认检查间隔', { error: err.message });
    return { checkIntervalMinutes: 10 };
  });
  const delay = msUntilNextCheck(reminderCfg.checkIntervalMinutes);
  schedulerTimer = setTimeout(runScheduledTimeoutCheck, delay);
}

async function runScheduledTimeoutCheck() {
  if (schedulerRunning) {
    logger.warn('自动超时检查仍在运行，本轮跳过');
    await scheduleNextTimeoutCheck();
    return;
  }

  schedulerRunning = true;
  try {
    await runTimeoutCheck();
  } finally {
    schedulerRunning = false;
    await scheduleNextTimeoutCheck();
  }
}

function startAutoReminderScheduler() {
  if (schedulerTimer) return;
  runScheduledTimeoutCheck().catch((err) =>
    logger.error('自动督办调度器启动失败', { error: err.message })
  );
}

module.exports = { runTimeoutCheck, startAutoReminderScheduler };
