/**
 * migrate-add-district.js
 * 为现有数据补填 district 字段（默认值：'射洪市'）
 *
 * 用法（在 server/ 目录下执行）：
 *   node src/scripts/migrate-add-district.js
 *
 * 说明：
 *   - 只处理 district 字段为 null/undefined 的文档，已有值的不覆盖
 *   - 涉及集合：AreaConfig、Demand、User
 *   - 同时为 AreaConfig 删除旧的单字段唯一索引（acceptArea），
 *     Mongoose 启动时会自动创建新的复合唯一索引 { district, acceptArea }
 */
require('dotenv').config();
const mongoose = require('mongoose');

const DEFAULT_DISTRICT = '射洪市';

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const db = mongoose.connection.db;

  // ── AreaConfig ──────────────────────────────────────────────────
  const areaConfigCol = db.collection('areaconfigs');

  const acResult = await areaConfigCol.updateMany(
    { district: { $exists: false } },
    { $set: { district: DEFAULT_DISTRICT } }
  );
  console.log(`AreaConfig: 补填 district → ${acResult.modifiedCount} 条`);

  // 删除旧的单字段唯一索引（如果存在），避免与新复合唯一索引冲突
  try {
    const indexes = await areaConfigCol.indexes();
    const oldIdx = indexes.find(idx =>
      idx.unique &&
      Object.keys(idx.key).length === 1 &&
      idx.key.acceptArea !== undefined
    );
    if (oldIdx) {
      await areaConfigCol.dropIndex(oldIdx.name);
      console.log(`AreaConfig: 已删除旧唯一索引 "${oldIdx.name}" (acceptArea)`);
    } else {
      console.log('AreaConfig: 未找到旧单字段唯一索引，无需删除');
    }
  } catch (err) {
    console.warn('AreaConfig: 删除旧索引时出错（可忽略）:', err.message);
  }

  // ── Demand ──────────────────────────────────────────────────────
  const demandCol = db.collection('demands');

  const dResult = await demandCol.updateMany(
    { district: { $exists: false } },
    { $set: { district: DEFAULT_DISTRICT } }
  );
  console.log(`Demand:     补填 district → ${dResult.modifiedCount} 条`);

  // ── User ────────────────────────────────────────────────────────
  const userCol = db.collection('users');

  const uResult = await userCol.updateMany(
    { district: { $exists: false } },
    { $set: { district: DEFAULT_DISTRICT } }
  );
  console.log(`User:       补填 district → ${uResult.modifiedCount} 条`);

  // ── 汇总 ────────────────────────────────────────────────────────
  const acTotal  = await areaConfigCol.countDocuments({ district: DEFAULT_DISTRICT });
  const dTotal   = await demandCol.countDocuments({ district: DEFAULT_DISTRICT });
  const uTotal   = await userCol.countDocuments({ district: DEFAULT_DISTRICT });

  console.log(`\n迁移完成，当前 district='${DEFAULT_DISTRICT}' 的文档数：`);
  console.log(`  AreaConfig: ${acTotal}`);
  console.log(`  Demand:     ${dTotal}`);
  console.log(`  User:       ${uTotal}`);
  console.log('\n提示：重启服务后 Mongoose 会自动创建新的复合唯一索引 { district, acceptArea }');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('迁移失败:', err.message);
  process.exit(1);
});
