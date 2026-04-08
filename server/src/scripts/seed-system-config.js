/**
 * seed-system-config.js
 * 初始化/更新系统配置项
 *
 * 用法（在 server/ 目录下执行）：
 *   node src/scripts/seed-system-config.js          # 仅补充缺失的配置项
 *   node src/scripts/seed-system-config.js --force  # 强制覆盖所有配置项为默认值
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('../models/config.model');

const forceUpdate = process.argv.includes('--force');

const CONFIGS = [
  {
    key: 'CENTER_NETWORK_MAP',
    label: '服务中心网络支撑映射',
    description: '服务中心与网络支撑中心的对应关系，用于需求创建时自动带出网络支撑中心',
    value: {
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
    }
  },
  {
    key: 'TIMEOUT_CONFIG',
    label: '超时阈值配置',
    description: '设计超时天数（默认2天）、施工超时天数（默认5天）、预警天数（设计1.5天/施工4天）。修改后需重启服务生效。',
    value: {
      designTimeoutDays: 2,
      constructionTimeoutDays: 5,
      designWarningDays: 1.5,
      constructionWarningDays: 4
    }
  }
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  for (const cfg of CONFIGS) {
    const existing = await Config.findOne({ key: cfg.key });
    if (!existing) {
      await Config.create({ ...cfg, updatedAt: new Date() });
      console.log(`✓ 已创建: ${cfg.key} (${cfg.label})`);
    } else if (forceUpdate) {
      await Config.updateOne({ key: cfg.key }, { $set: { value: cfg.value, label: cfg.label, description: cfg.description, updatedAt: new Date() } });
      console.log(`✓ 已覆盖: ${cfg.key} (${cfg.label})`);
    } else {
      console.log(`- 已存在，跳过: ${cfg.key}`);
    }
  }

  // 输出当前所有配置
  const all = await Config.find().sort({ key: 1 }).lean();
  console.log(`\n当前数据库中共 ${all.length} 条系统配置：`);
  all.forEach(c => console.log(`  [${c.key}] ${c.label || ''}`));

  await mongoose.disconnect();
  console.log('\n完成');
}

run().catch(err => {
  console.error('执行失败:', err.message);
  process.exit(1);
});
