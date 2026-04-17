const Config = require('../models/config.model');

const AUTO_REMINDER_CONFIG_KEY = 'AUTO_REMINDER_CONFIG';

const DEFAULT_AUTO_REMINDER_CONFIG = {
  timezone: 'Asia/Shanghai',
  businessWindowStart: '08:30',
  businessWindowEnd: '18:30',
  checkIntervalMinutes: 10,
  normalReminderBatches: ['09:00', '14:30', '17:30'],
  urgentReminderBatches: ['18:20'],
  batchGraceMinutes: 9,
  maxSendsPerDemandPerDay: 2,
  maxSendsPerEventPerDay: 2
};

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseTime(value, fallback) {
  const source = typeof value === 'string' ? value : fallback;
  const match = /^(\d{1,2}):(\d{2})$/.exec(source || '');
  if (!match) return parseTime(fallback, '00:00');

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return parseTime(fallback, '00:00');
  }
  return { label: `${pad2(hour)}:${pad2(minute)}`, minutes: hour * 60 + minute };
}

function normalizeBatchList(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  const normalized = list
    .map((item) => parseTime(item, null))
    .filter((item) => item && item.label !== '00:00')
    .map((item) => item.label);
  return [...new Set(normalized)].sort();
}

function positiveInteger(value, fallback, min = 1, max = 1440) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) return fallback;
  return num;
}

function normalizeAutoReminderConfig(value = {}) {
  const cfg = {
    timezone: typeof value.timezone === 'string' && value.timezone.trim()
      ? value.timezone.trim()
      : DEFAULT_AUTO_REMINDER_CONFIG.timezone,
    businessWindowStart: parseTime(value.businessWindowStart, DEFAULT_AUTO_REMINDER_CONFIG.businessWindowStart).label,
    businessWindowEnd: parseTime(value.businessWindowEnd, DEFAULT_AUTO_REMINDER_CONFIG.businessWindowEnd).label,
    checkIntervalMinutes: positiveInteger(value.checkIntervalMinutes, DEFAULT_AUTO_REMINDER_CONFIG.checkIntervalMinutes, 1, 60),
    normalReminderBatches: normalizeBatchList(value.normalReminderBatches, DEFAULT_AUTO_REMINDER_CONFIG.normalReminderBatches),
    urgentReminderBatches: normalizeBatchList(value.urgentReminderBatches, DEFAULT_AUTO_REMINDER_CONFIG.urgentReminderBatches),
    batchGraceMinutes: positiveInteger(value.batchGraceMinutes, DEFAULT_AUTO_REMINDER_CONFIG.batchGraceMinutes, 0, 30),
    maxSendsPerDemandPerDay: positiveInteger(value.maxSendsPerDemandPerDay, DEFAULT_AUTO_REMINDER_CONFIG.maxSendsPerDemandPerDay, 1, 20),
    maxSendsPerEventPerDay: positiveInteger(value.maxSendsPerEventPerDay, DEFAULT_AUTO_REMINDER_CONFIG.maxSendsPerEventPerDay, 1, 20)
  };

  const start = parseTime(cfg.businessWindowStart, DEFAULT_AUTO_REMINDER_CONFIG.businessWindowStart).minutes;
  const end = parseTime(cfg.businessWindowEnd, DEFAULT_AUTO_REMINDER_CONFIG.businessWindowEnd).minutes;
  if (start >= end) {
    cfg.businessWindowStart = DEFAULT_AUTO_REMINDER_CONFIG.businessWindowStart;
    cfg.businessWindowEnd = DEFAULT_AUTO_REMINDER_CONFIG.businessWindowEnd;
  }

  if (!cfg.normalReminderBatches.length) {
    cfg.normalReminderBatches = [...DEFAULT_AUTO_REMINDER_CONFIG.normalReminderBatches];
  }

  return cfg;
}

async function getAutoReminderConfig() {
  const config = await Config.findOne({ key: AUTO_REMINDER_CONFIG_KEY }).lean();
  return normalizeAutoReminderConfig(config?.value || {});
}

function getZonedParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });

  const values = {};
  formatter.formatToParts(date).forEach((part) => {
    if (part.type !== 'literal') values[part.type] = part.value;
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function zonedDateKey(date, cfg) {
  const parts = getZonedParts(date, cfg.timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function zonedMinutesOfDay(date, cfg) {
  const parts = getZonedParts(date, cfg.timezone);
  return parts.hour * 60 + parts.minute;
}

function isBusinessWindow(date, cfg) {
  const minutes = zonedMinutesOfDay(date, cfg);
  const start = parseTime(cfg.businessWindowStart, DEFAULT_AUTO_REMINDER_CONFIG.businessWindowStart).minutes;
  const end = parseTime(cfg.businessWindowEnd, DEFAULT_AUTO_REMINDER_CONFIG.businessWindowEnd).minutes;
  return minutes >= start && minutes <= end;
}

function isUrgentEvent(demand, event) {
  return event.severity === 'timeout' || demand.urgency === '特急';
}

function findSendBatch(date, cfg, demand, event) {
  if (!isBusinessWindow(date, cfg)) return null;

  const minutes = zonedMinutesOfDay(date, cfg);
  const batchLabels = [...cfg.normalReminderBatches];
  if (isUrgentEvent(demand, event)) batchLabels.push(...cfg.urgentReminderBatches);

  const matched = [...new Set(batchLabels)]
    .map((label) => parseTime(label, null))
    .filter(Boolean)
    .find((batch) => minutes >= batch.minutes && minutes - batch.minutes <= cfg.batchGraceMinutes);

  if (!matched) return null;
  return {
    label: matched.label,
    slot: `${zonedDateKey(date, cfg)}-${matched.label.replace(':', '')}`
  };
}

function getDailyState(state, dateKey) {
  if (!state._daily || state._daily.date !== dateKey) {
    state._daily = {
      date: dateKey,
      demandSendCount: 0,
      eventSendCounts: {}
    };
  }

  if (!state._daily.eventSendCounts || typeof state._daily.eventSendCounts !== 'object') {
    state._daily.eventSendCounts = {};
  }

  return state._daily;
}

function msUntilNextCheck(intervalMinutes, now = new Date()) {
  const intervalMs = intervalMinutes * 60 * 1000;
  const elapsed = now.getTime() % intervalMs;
  const delay = intervalMs - elapsed;
  return delay < 1000 ? delay + intervalMs : delay;
}

module.exports = {
  AUTO_REMINDER_CONFIG_KEY,
  DEFAULT_AUTO_REMINDER_CONFIG,
  normalizeAutoReminderConfig,
  getAutoReminderConfig,
  zonedDateKey,
  findSendBatch,
  getDailyState,
  msUntilNextCheck
};
