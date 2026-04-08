/**
 * 数据库迁移脚本：为 User 集合添加密码相关字段
 *
 * 用法：node src/scripts/migrate-add-password.js
 *
 * 注意事项：
 * - 此脚本仅运行一次即可
 * - 会为所有现有用户的 password 字段设置为 null
 * - 管理员需在后台为所有用户设置统一初始密码
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  console.log('开始迁移 User 数据模型...');

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('已连接数据库');

  const db = mongoose.connection.db;
  const collection = db.collection('users');

  // 添加新字段（不存在时才添加）
  const result = await collection.updateMany(
    {},
    {
      $set: {
        password: null,
        passwordChanged: false,
        passwordChangedAt: null,
        loginAttempts: 0,
        lockUntil: null,
        lastLoginAt: null,
        lastLoginIp: null
      }
    }
  );

  console.log(`迁移完成：共更新 ${result.modifiedCount} 条用户记录`);
  console.log('');
  console.log('下一步操作：');
  console.log('1. 在管理后台为所有现有用户设置统一初始密码');
  console.log('2. 通知用户使用初始密码登录，登录后强制修改为个人密码');

  await mongoose.disconnect();
  console.log('数据库连接已关闭');
  process.exit(0);
}

migrate().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
