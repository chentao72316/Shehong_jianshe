require('dotenv').config();
const mongoose = require('mongoose');
require('../models/user.model');
const Demand = require('../models/demand.model');
const { syncDemandWithPopulate } = require('../utils/feishu-bitable');

async function run() {
  const demandNos = process.argv.slice(2).filter(Boolean);

  if (demandNos.length === 0) {
    console.error('用法: node src/scripts/retry-feishu-bitable-sync.js <工单编号...>');
    process.exit(1);
  }

  if (!process.env.MONGODB_URI) {
    console.error('缺少 MONGODB_URI 配置');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  let failed = false;

  for (const demandNo of demandNos) {
    try {
      const demand = await Demand.findOne({ demandNo });
      if (!demand) {
        failed = true;
        console.error(`未找到工单: ${demandNo}`);
        continue;
      }

      console.log(`开始重试同步飞书多维表格: ${demandNo}`);
      await syncDemandWithPopulate(demand);
      console.log(`同步流程已执行: ${demandNo}`);
    } catch (err) {
      failed = true;
      console.error(`同步失败: ${demandNo} - ${err.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('MongoDB disconnected');

  if (failed) {
    process.exit(1);
  }
}

run().catch(async err => {
  console.error(`脚本执行失败: ${err.message}`);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors in script shutdown
  }
  process.exit(1);
});
