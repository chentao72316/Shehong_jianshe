const Config = require('../models/config.model');
const { logger } = require('../utils/logger');
const { DEFAULT_TIMEOUT_CONFIG } = require('../utils/timeout-policy');

// 初始化系统配置
async function initSystemConfig() {
  try {
    // 初始化超时阈值配置
    const existingTimeoutConfig = await Config.findOne({ key: 'TIMEOUT_CONFIG' });
    if (!existingTimeoutConfig) {
      await Config.create({
        key: 'TIMEOUT_CONFIG',
        value: DEFAULT_TIMEOUT_CONFIG,
        label: '超时阈值配置',
        description: '设计、施工、跨区审核、开通确认、总体超时与预警天数配置。总体超时须不小于设计超时+施工超时。'
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

module.exports = { initSystemConfig, DEFAULT_TIMEOUT_CONFIG };
