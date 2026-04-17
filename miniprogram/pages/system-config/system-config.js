const { getConfig, updateConfig } = require('../../utils/api');

const KEY_TIMEOUT = 'TIMEOUT_CONFIG';
const KEY_AUTO_REMINDER = 'AUTO_REMINDER_CONFIG';

const DEFAULT_TIMEOUT_CONFIG = {
  designTimeoutDays: 2,
  designWarningDays: 1.5,
  constructionTimeoutDays: 5,
  constructionWarningDays: 4,
  crossAreaAuditTimeoutDays: 1,
  crossAreaAuditWarningDays: 0.5,
  confirmationTimeoutDays: 1,
  confirmationWarningDays: 0.5,
  overallTimeoutDays: 7,
  overallWarningDays: 6
};

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

const FIELD_GROUPS = [
  [
    { key: 'designTimeoutDays', label: '设计超时天数', max: 30 },
    { key: 'designWarningDays', label: '设计预警天数', max: 30 }
  ],
  [
    { key: 'constructionTimeoutDays', label: '施工超时天数', max: 60 },
    { key: 'constructionWarningDays', label: '施工预警天数', max: 60 }
  ],
  [
    { key: 'crossAreaAuditTimeoutDays', label: '跨区审核超时', max: 30 },
    { key: 'crossAreaAuditWarningDays', label: '跨区审核预警', max: 30 }
  ],
  [
    { key: 'confirmationTimeoutDays', label: '开通确认超时', max: 30 },
    { key: 'confirmationWarningDays', label: '开通确认预警', max: 30 }
  ],
  [
    { key: 'overallTimeoutDays', label: '总体超时天数', max: 120 },
    { key: 'overallWarningDays', label: '总体预警天数', max: 120 }
  ]
];

function buildFieldGroups(form) {
  return FIELD_GROUPS.map(group => group.map(field => ({
    ...field,
    value: form[field.key]
  })));
}

function toPositiveNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
}

function normalizeConfig(value = {}) {
  const config = {};
  Object.keys(DEFAULT_TIMEOUT_CONFIG).forEach((key) => {
    config[key] = toPositiveNumber(value[key], DEFAULT_TIMEOUT_CONFIG[key]);
  });
  return config;
}

function isTimeLabel(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function timeToMinutes(value) {
  if (!isTimeLabel(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function normalizeTimeList(value, fallback) {
  const list = Array.isArray(value) ? value : fallback;
  return [...new Set(list.map(item => String(item || '').trim()).filter(isTimeLabel))].sort();
}

function toPositiveInteger(value, fallback, min, max) {
  const num = Number(value);
  if (!Number.isInteger(num) || num < min || num > max) return fallback;
  return num;
}

function normalizeAutoReminderConfig(value = {}) {
  return {
    timezone: DEFAULT_AUTO_REMINDER_CONFIG.timezone,
    businessWindowStart: isTimeLabel(value.businessWindowStart) ? value.businessWindowStart : DEFAULT_AUTO_REMINDER_CONFIG.businessWindowStart,
    businessWindowEnd: isTimeLabel(value.businessWindowEnd) ? value.businessWindowEnd : DEFAULT_AUTO_REMINDER_CONFIG.businessWindowEnd,
    checkIntervalMinutes: toPositiveInteger(value.checkIntervalMinutes, DEFAULT_AUTO_REMINDER_CONFIG.checkIntervalMinutes, 1, 60),
    normalReminderBatches: normalizeTimeList(value.normalReminderBatches, DEFAULT_AUTO_REMINDER_CONFIG.normalReminderBatches),
    urgentReminderBatches: normalizeTimeList(value.urgentReminderBatches, DEFAULT_AUTO_REMINDER_CONFIG.urgentReminderBatches),
    batchGraceMinutes: toPositiveInteger(value.batchGraceMinutes, DEFAULT_AUTO_REMINDER_CONFIG.batchGraceMinutes, 0, 30),
    maxSendsPerDemandPerDay: toPositiveInteger(value.maxSendsPerDemandPerDay, DEFAULT_AUTO_REMINDER_CONFIG.maxSendsPerDemandPerDay, 1, 20),
    maxSendsPerEventPerDay: toPositiveInteger(value.maxSendsPerEventPerDay, DEFAULT_AUTO_REMINDER_CONFIG.maxSendsPerEventPerDay, 1, 20)
  };
}

function joinTimeList(list) {
  return normalizeTimeList(list, []).join('、');
}

function parseTimeText(value) {
  return normalizeTimeList(String(value || '').split(/[、,，\s]+/), []);
}

Page({
  data: {
    loading: true,
    saving: false,
    savingAutoReminder: false,
    form: { ...DEFAULT_TIMEOUT_CONFIG },
    fieldGroups: buildFieldGroups(DEFAULT_TIMEOUT_CONFIG),
    autoReminderForm: { ...DEFAULT_AUTO_REMINDER_CONFIG },
    normalBatchText: joinTimeList(DEFAULT_AUTO_REMINDER_CONFIG.normalReminderBatches),
    urgentBatchText: joinTimeList(DEFAULT_AUTO_REMINDER_CONFIG.urgentReminderBatches)
  },

  onLoad() {
    this.loadConfig();
  },

  async loadConfig() {
    this.setData({ loading: true });
    try {
      const [timeoutRes, autoReminderRes] = await Promise.all([
        getConfig(KEY_TIMEOUT),
        getConfig(KEY_AUTO_REMINDER).catch(() => ({ data: DEFAULT_AUTO_REMINDER_CONFIG }))
      ]);
      const form = normalizeConfig(timeoutRes.data);
      const autoReminderForm = normalizeAutoReminderConfig(autoReminderRes.data);
      this.setData({
        form,
        fieldGroups: buildFieldGroups(form),
        autoReminderForm,
        normalBatchText: joinTimeList(autoReminderForm.normalReminderBatches),
        urgentBatchText: joinTimeList(autoReminderForm.urgentReminderBatches),
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onNumberInput(e) {
    const { field } = e.currentTarget.dataset;
    const form = { ...this.data.form, [field]: e.detail.value };
    this.setData({ form, fieldGroups: buildFieldGroups(form) });
  },

  onAutoInput(e) {
    const { field } = e.currentTarget.dataset;
    const autoReminderForm = { ...this.data.autoReminderForm, [field]: e.detail.value };
    this.setData({ autoReminderForm });
  },

  onAutoNumberInput(e) {
    const { field } = e.currentTarget.dataset;
    const autoReminderForm = { ...this.data.autoReminderForm, [field]: Number(e.detail.value) };
    this.setData({ autoReminderForm });
  },

  onBatchTextInput(e) {
    const { type } = e.currentTarget.dataset;
    if (type === 'normal') {
      this.setData({ normalBatchText: e.detail.value });
    } else {
      this.setData({ urgentBatchText: e.detail.value });
    }
  },

  validateForm(config) {
    const pairs = [
      ['designWarningDays', 'designTimeoutDays', '设计预警天数须小于设计超时天数'],
      ['constructionWarningDays', 'constructionTimeoutDays', '施工预警天数须小于施工超时天数'],
      ['crossAreaAuditWarningDays', 'crossAreaAuditTimeoutDays', '跨区审核预警天数须小于跨区审核超时天数'],
      ['confirmationWarningDays', 'confirmationTimeoutDays', '开通确认预警天数须小于开通确认超时天数'],
      ['overallWarningDays', 'overallTimeoutDays', '总体预警天数须小于总体超时天数']
    ];

    for (const [warningKey, timeoutKey, message] of pairs) {
      if (config[warningKey] >= config[timeoutKey]) return message;
    }

    if (config.overallTimeoutDays < config.designTimeoutDays + config.constructionTimeoutDays) {
      return '总体超时天数须不小于设计超时天数与施工超时天数之和';
    }
    return '';
  },

  async onSave() {
    const config = normalizeConfig(this.data.form);
    const error = this.validateForm(config);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({ saving: true });
    try {
      await updateConfig(KEY_TIMEOUT, {
        value: config,
        label: '超时阈值配置',
        description: '设计、施工、跨区审核、开通确认、总体超时与预警天数配置'
      });
      this.setData({ form: config, fieldGroups: buildFieldGroups(config), saving: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch {
      this.setData({ saving: false });
    }
  },

  validateAutoReminderConfig(config) {
    const start = timeToMinutes(config.businessWindowStart);
    const end = timeToMinutes(config.businessWindowEnd);
    if (start == null || end == null || start >= end) return '发送窗口格式错误';
    if (!config.normalReminderBatches.length) return '至少配置一个普通发送批次';

    const allBatches = [...config.normalReminderBatches, ...config.urgentReminderBatches];
    const outOfWindow = allBatches.some((item) => {
      const minutes = timeToMinutes(item);
      return minutes == null || minutes < start || minutes > end;
    });
    if (outOfWindow) return '发送批次须位于发送窗口内';
    return '';
  },

  async onSaveAutoReminder() {
    const config = normalizeAutoReminderConfig({
      ...this.data.autoReminderForm,
      normalReminderBatches: parseTimeText(this.data.normalBatchText),
      urgentReminderBatches: parseTimeText(this.data.urgentBatchText)
    });
    const error = this.validateAutoReminderConfig(config);
    if (error) {
      wx.showToast({ title: error, icon: 'none' });
      return;
    }

    this.setData({ savingAutoReminder: true });
    try {
      await updateConfig(KEY_AUTO_REMINDER, {
        value: config,
        label: '自动督办发送配置',
        description: '自动督办按北京时间检查、固定批次发送、每日限频，避免服务启动时间影响飞书提醒。'
      });
      this.setData({
        autoReminderForm: config,
        normalBatchText: joinTimeList(config.normalReminderBatches),
        urgentBatchText: joinTimeList(config.urgentReminderBatches),
        savingAutoReminder: false
      });
      wx.showToast({ title: '保存成功', icon: 'success' });
    } catch {
      this.setData({ savingAutoReminder: false });
    }
  }
});
