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
const { DEFAULT_TIMEOUT_CONFIG } = require('../utils/timeout-policy');

const forceUpdate = process.argv.includes('--force');

const CONFIGS = [
  {
    key: 'TIMEOUT_CONFIG',
    label: '超时阈值配置',
    description: '设计、施工、跨区审核、开通确认、总体超时与预警天数配置。总体超时须不小于设计超时+施工超时。',
    value: DEFAULT_TIMEOUT_CONFIG
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
