/**
 * migrate-demand-status.js
 * 工单状态枚举简化迁移
 *
 * 旧状态 → 新状态映射：
 *   待指派         → 待审核
 *   设计中（超时）  → 设计中
 *   待施工         → 施工中
 *   施工中（超时）  → 施工中
 *   待监理验收     → 待确认
 *   监理验收中     → 待确认
 *   整体超时       → 施工中
 *
 * 执行方式（独立运行）：
 *   node scripts/migrate-demand-status.js
 *
 * 或在 app.js 启动时自动调用 migrateDemandStatus()
 */
require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shehong';

const STATUS_MAP = {
  '待指派': '待审核',
  '设计中（超时）': '设计中',
  '待施工': '施工中',
  '施工中（超时）': '施工中',
  '待监理验收': '待确认',
  '监理验收中': '待确认',
  '整体超时': '施工中'
};

const VALID_STATUSES = ['待审核', '设计中', '施工中', '待确认', '已开通', '已驳回'];

async function migrateDemandStatus() {
  if (mongoose.connection.readyState !== 0) {
    // 已连接（app.js 中调用），使用现有连接
  } else {
    await mongoose.connect(MONGODB_URI);
  }
  console.log('[迁移] 开始工单状态迁移...');

  const db = mongoose.connection.db;
  const collection = db.collection('demands');

  let matched = 0;
  let updated = 0;
  let invalid = 0;

  const cursor = collection.find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    matched++;
    const oldStatus = doc.status;

    if (STATUS_MAP[oldStatus]) {
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: { status: STATUS_MAP[oldStatus] },
          $push: {
            logs: {
              content: `系统迁移：状态由「${oldStatus}」自动变更为「${STATUS_MAP[oldStatus]}」`,
              operatorId: null,
              operatorName: '系统',
              createdAt: new Date()
            }
          }
        }
      );
      updated++;
      console.log(`  [迁移] ${doc.demandNo}: ${oldStatus} → ${STATUS_MAP[oldStatus]}`);
    } else if (!VALID_STATUSES.includes(oldStatus)) {
      invalid++;
      console.warn(`  [警告] ${doc.demandNo}: 未知状态「${oldStatus}」，请人工处理`);
    }
  }

  console.log(`[迁移] 完成：共扫描 ${matched} 条，更新 ${updated} 条，异常 ${invalid} 条`);

  if (mongoose.connection.readyState === 0) {
    await mongoose.disconnect();
  }
}

// 独立运行时直接执行
if (require.main === module) {
  migrateDemandStatus()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[迁移] 失败:', err);
      process.exit(1);
    });
}

module.exports = { migrateDemandStatus };
