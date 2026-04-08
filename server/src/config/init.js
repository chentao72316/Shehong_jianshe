const Config = require('../models/config.model');
const { logger } = require('../utils/logger');

// 服务中心与网络支撑中心默认映射（按区县分层）
const DEFAULT_CENTER_NETWORK_MAP = {
  '射洪市': {
    '太和东服务中心': '城区网络支撑中心',
    '太和西服务中心': '城区网络支撑中心',
    '平安街道服务中心': '城区网络支撑中心',
    '大榆服务中心': '河东网络支撑中心',
    '仁和服务中心': '河东网络支撑中心',
    '复兴服务中心': '河东网络支撑中心',
    '沱牌服务中心': '河西网络支撑中心',
    '金华服务中心': '河西网络支撑中心',
    '太乙服务中心': '河西网络支撑中心',
    '射洪分公司': '网络建维中心',
    '销售中心': '网络建维中心',
    '校园服务中心': '网络建维中心',
    '商客服务中心': '网络建维中心',
    '企业服务中心': '网络建维中心',
    '集团客户中心': '网络建维中心',
    '高质量服务中心': '网络建维中心'
  },
  '蓬溪县': {},
  '大英县': {},
  '船山区': {},
  '安居区': {}
};

// 默认超时阈值配置
const DEFAULT_TIMEOUT_CONFIG = {
  designTimeoutDays: 2,
  constructionTimeoutDays: 5,
  designWarningDays: 1.5,
  constructionWarningDays: 4
};

// 初始化系统配置
async function initSystemConfig() {
  try {
  // 初始化服务中心与网络支撑中心映射
  const existingConfig = await Config.findOne({ key: 'CENTER_NETWORK_MAP' });
  if (!existingConfig) {
    await Config.create({
      key: 'CENTER_NETWORK_MAP',
      value: DEFAULT_CENTER_NETWORK_MAP,
      label: '服务中心网络支撑映射',
      description: '各区县服务中心与网络支撑中心的对应关系，用于需求创建时自动带出网络支撑中心'
    });
    logger.info('系统配置初始化：CENTER_NETWORK_MAP 已创建（嵌套格式）');
  } else {
    // 旧格式迁移：若 value 是平铺对象（首层 key 不是区县名），自动包裹到射洪市
    const v = existingConfig.value;
    const DISTRICT_KEYS = new Set(['射洪市', '蓬溪县', '大英县', '船山区', '安居区']);
    const topKeys = Object.keys(v || {});
    const isFlat = topKeys.length > 0 && !topKeys.some(k => DISTRICT_KEYS.has(k));
    if (isFlat) {
      const migrated = { '射洪市': v, '蓬溪县': {}, '大英县': {}, '船山区': {}, '安居区': {} };
      await Config.updateOne({ key: 'CENTER_NETWORK_MAP' }, { $set: { value: migrated } });
      logger.info('系统配置迁移：CENTER_NETWORK_MAP 从平铺格式升级为嵌套格式');
    } else {
      logger.info('系统配置初始化：CENTER_NETWORK_MAP 已存在，跳过');
    }
  }

    // 初始化超时阈值配置
    const existingTimeoutConfig = await Config.findOne({ key: 'TIMEOUT_CONFIG' });
    if (!existingTimeoutConfig) {
      await Config.create({
        key: 'TIMEOUT_CONFIG',
        value: DEFAULT_TIMEOUT_CONFIG,
        label: '超时阈值配置',
        description: '设计超时天数（默认2天）、施工超时天数（默认5天）、预警天数（设计1.5天/施工4天）。修改后需重启服务生效。'
      });
      logger.info('系统配置初始化：TIMEOUT_CONFIG 已创建');
    } else {
      logger.info('系统配置初始化：TIMEOUT_CONFIG 已存在，跳过');
    }

    // 初始化 FastGPT 知识问答配置
    const existingFastgptHost = await Config.findOne({ key: 'FASTGPT_HOST' });
    if (!existingFastgptHost) {
      await Config.create({
        key: 'FASTGPT_HOST',
        value: '',
        label: 'FastGPT 服务地址',
        description: 'FastGPT API 根地址，例如 https://cloud.fastgpt.cn/api，用于「问问」知识问答功能'
      });
      logger.info('系统配置初始化：FASTGPT_HOST 已创建');
    } else {
      logger.info('系统配置初始化：FASTGPT_HOST 已存在，跳过');
    }

    const existingFastgptKey = await Config.findOne({ key: 'FASTGPT_API_KEY' });
    if (!existingFastgptKey) {
      await Config.create({
        key: 'FASTGPT_API_KEY',
        value: '',
        label: 'FastGPT API Key',
        description: 'FastGPT 知识库应用的 API 访问密钥，在 FastGPT 控制台「API访问」中获取'
      });
      logger.info('系统配置初始化：FASTGPT_API_KEY 已创建');
    } else {
      logger.info('系统配置初始化：FASTGPT_API_KEY 已存在，跳过');
    }
  } catch (err) {
    logger.error('系统配置初始化失败', { error: err.message });
  }
}

module.exports = { initSystemConfig, DEFAULT_CENTER_NETWORK_MAP, DEFAULT_TIMEOUT_CONFIG };
