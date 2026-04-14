const Config = require('../models/config.model');

const TIMEOUT_CONFIG_KEY = 'TIMEOUT_CONFIG';
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_TIMEOUT_CONFIG = {
  designTimeoutDays: 2,
  constructionTimeoutDays: 5,
  designWarningDays: 1.5,
  constructionWarningDays: 4,
  crossAreaAuditWarningDays: 0.5,
  crossAreaAuditTimeoutDays: 1,
  confirmationWarningDays: 0.5,
  confirmationTimeoutDays: 1,
  overallWarningDays: 6,
  overallTimeoutDays: 7
};

const EVENT_META = {
  designWarning: {
    label: '设计即将超时',
    timeoutType: '设计预警',
    stage: '设计',
    severity: 'warning',
    status: '设计中',
    startField: 'designAssignTime',
    warningDaysField: 'designWarningDays',
    timeoutDaysField: 'designTimeoutDays'
  },
  designTimeout: {
    label: '设计超时',
    timeoutType: '设计超时',
    stage: '设计',
    severity: 'timeout',
    status: '设计中',
    startField: 'designAssignTime',
    timeoutDaysField: 'designTimeoutDays'
  },
  constructionWarning: {
    label: '施工即将超时',
    timeoutType: '施工预警',
    stage: '施工',
    severity: 'warning',
    status: '施工中',
    startField: 'constructionAssignTime',
    warningDaysField: 'constructionWarningDays',
    timeoutDaysField: 'constructionTimeoutDays'
  },
  constructionTimeout: {
    label: '施工超时',
    timeoutType: '施工超时',
    stage: '施工',
    severity: 'timeout',
    status: '施工中',
    startField: 'constructionAssignTime',
    timeoutDaysField: 'constructionTimeoutDays'
  },
  crossAreaAuditWarning: {
    label: '跨区审核即将超时',
    timeoutType: '跨区审核预警',
    stage: '跨区审核',
    severity: 'warning',
    status: '待审核',
    startField: 'createdAt',
    requiresCrossAreaReviewer: true,
    warningDaysField: 'crossAreaAuditWarningDays',
    timeoutDaysField: 'crossAreaAuditTimeoutDays'
  },
  crossAreaAuditTimeout: {
    label: '跨区审核超时',
    timeoutType: '跨区审核超时',
    stage: '跨区审核',
    severity: 'timeout',
    status: '待审核',
    startField: 'createdAt',
    requiresCrossAreaReviewer: true,
    timeoutDaysField: 'crossAreaAuditTimeoutDays'
  },
  confirmationWarning: {
    label: '开通确认即将超时',
    timeoutType: '开通确认预警',
    stage: '开通确认',
    severity: 'warning',
    status: '待确认',
    startField: 'confirmPendingTime',
    fallbackStartField: 'updatedAt',
    warningDaysField: 'confirmationWarningDays',
    timeoutDaysField: 'confirmationTimeoutDays'
  },
  confirmationTimeout: {
    label: '开通确认超时',
    timeoutType: '开通确认超时',
    stage: '开通确认',
    severity: 'timeout',
    status: '待确认',
    startField: 'confirmPendingTime',
    fallbackStartField: 'updatedAt',
    timeoutDaysField: 'confirmationTimeoutDays'
  },
  overallWarning: {
    label: '总体即将超时',
    timeoutType: '总体预警',
    stage: '总体',
    severity: 'warning',
    startField: 'createdAt',
    warningDaysField: 'overallWarningDays',
    timeoutDaysField: 'overallTimeoutDays',
    excludesStatuses: ['已开通', '已驳回']
  },
  overallTimeout: {
    label: '总体超时',
    timeoutType: '总体超时',
    stage: '总体',
    severity: 'timeout',
    startField: 'createdAt',
    timeoutDaysField: 'overallTimeoutDays',
    excludesStatuses: ['已开通', '已驳回']
  }
};

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function normalizeTimeoutConfig(value = {}) {
  const cfg = {};
  for (const key of Object.keys(DEFAULT_TIMEOUT_CONFIG)) {
    cfg[key] = toNumber(value[key], DEFAULT_TIMEOUT_CONFIG[key]);
  }

  if (cfg.designWarningDays >= cfg.designTimeoutDays) {
    cfg.designWarningDays = Math.max(0.5, cfg.designTimeoutDays - 0.5);
  }
  if (cfg.constructionWarningDays >= cfg.constructionTimeoutDays) {
    cfg.constructionWarningDays = Math.max(0.5, cfg.constructionTimeoutDays - 0.5);
  }
  if (cfg.crossAreaAuditWarningDays >= cfg.crossAreaAuditTimeoutDays) {
    cfg.crossAreaAuditWarningDays = Math.max(0.5, cfg.crossAreaAuditTimeoutDays - 0.5);
  }
  if (cfg.confirmationWarningDays >= cfg.confirmationTimeoutDays) {
    cfg.confirmationWarningDays = Math.max(0.5, cfg.confirmationTimeoutDays - 0.5);
  }

  const minOverall = cfg.designTimeoutDays + cfg.constructionTimeoutDays;
  if (cfg.overallTimeoutDays < minOverall) {
    cfg.overallTimeoutDays = minOverall;
  }
  if (cfg.overallWarningDays >= cfg.overallTimeoutDays) {
    cfg.overallWarningDays = Math.max(0.5, cfg.overallTimeoutDays - 0.5);
  }

  return cfg;
}

async function getTimeoutConfig() {
  const config = await Config.findOne({ key: TIMEOUT_CONFIG_KEY }).lean();
  return normalizeTimeoutConfig(config?.value || {});
}

function getStartTime(demand, meta) {
  const raw = demand?.[meta.startField] || (meta.fallbackStartField ? demand?.[meta.fallbackStartField] : null);
  if (!raw) return null;
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

function isMetaApplicable(demand, meta) {
  if (meta.status && demand.status !== meta.status) return false;
  if (meta.excludesStatuses?.includes(demand.status)) return false;
  if (meta.requiresCrossAreaReviewer && !demand.crossAreaReviewerId) return false;
  return true;
}

function makeEvent(type, demand, meta, cfg, now) {
  if (!isMetaApplicable(demand, meta)) return null;

  const startTime = getStartTime(demand, meta);
  if (!startTime) return null;

  const elapsedMs = now.getTime() - startTime.getTime();
  const timeoutDays = cfg[meta.timeoutDaysField];
  const warningDays = meta.warningDaysField ? cfg[meta.warningDaysField] : null;
  const timeoutMs = timeoutDays * DAY_MS;
  const warningMs = warningDays ? warningDays * DAY_MS : null;

  if (meta.severity === 'warning' && !(elapsedMs >= warningMs && elapsedMs < timeoutMs)) return null;
  if (meta.severity === 'timeout' && elapsedMs < timeoutMs) return null;

  const thresholdDays = meta.severity === 'warning' ? warningDays : timeoutDays;
  return {
    type,
    label: meta.label,
    timeoutType: meta.timeoutType,
    stage: meta.stage,
    severity: meta.severity,
    startField: meta.startField,
    startTime,
    elapsedMs,
    elapsedDays: elapsedMs / DAY_MS,
    thresholdDays,
    timeoutDays,
    remainingMs: Math.max(0, timeoutMs - elapsedMs)
  };
}

function getDemandTimeoutEvents(demand, cfg, now = new Date()) {
  const events = [];
  for (const [type, meta] of Object.entries(EVENT_META)) {
    const event = makeEvent(type, demand, meta, cfg, now);
    if (event) events.push(event);
  }
  return events;
}

module.exports = {
  TIMEOUT_CONFIG_KEY,
  DAY_MS,
  DEFAULT_TIMEOUT_CONFIG,
  EVENT_META,
  normalizeTimeoutConfig,
  getTimeoutConfig,
  getDemandTimeoutEvents
};
