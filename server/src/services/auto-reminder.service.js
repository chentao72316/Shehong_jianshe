const Demand = require('../models/demand.model');
const { logger } = require('../utils/logger');
const { notifyTimeoutEvent } = require('../utils/notify');
const { getTimeoutConfig, getDemandTimeoutEvents } = require('../utils/timeout-policy');

const AUTO_REMINDER_STATUSES = ['设计中', '施工中', '待审核', '待确认'];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function sendSlot(now) {
  const minutes = minutesOfDay(now);
  const morning = 8 * 60 + 30;
  const eveningWindowStart = 17 * 60 + 30;
  const evening = 18 * 60 + 30;
  if (minutes < morning || minutes > evening) return null;
  if (minutes >= eveningWindowStart) return `${dateKey(now)}-PM`;
  if (minutes >= morning) return `${dateKey(now)}-AM`;
  return null;
}

function isBusinessWindow(now) {
  const minutes = minutesOfDay(now);
  return minutes >= 8 * 60 + 30 && minutes <= 18 * 60 + 30;
}

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

function shouldSendAutoReminder(demand, event, now) {
  if (isMuted(demand, event.type)) return false;
  const state = ensureReminderState(demand);
  const eventState = state[event.type] || {};
  const slot = sendSlot(now);
  const inBusinessWindow = isBusinessWindow(now);
  const isFirstDetection = !eventState.firstDetectedAt;

  eventState.firstDetectedAt = eventState.firstDetectedAt || now;
  eventState.lastDetectedAt = now;
  eventState.lastSeverity = event.severity;
  state[event.type] = eventState;

  if (isFirstDetection && inBusinessWindow) {
    eventState.lastSentAt = now;
    eventState.lastSentSlot = slot || `${dateKey(now)}-FIRST`;
    return true;
  }

  if (slot && eventState.lastSentSlot !== slot) {
    eventState.lastSentAt = now;
    eventState.lastSentSlot = slot;
    return true;
  }

  return false;
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
        if (shouldSendAutoReminder(demand, event, now)) {
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

    logger.info('自动超时检查完成', { detected, sent });
  } catch (err) {
    logger.error('自动超时检查异常', { error: err.message });
  }
}

module.exports = { runTimeoutCheck };
