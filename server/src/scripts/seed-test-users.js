// DEV-ONLY: Remove this file before production
/**
 * seed-test-users.js
 * 初始化/清理测试账号
 *
 * 用法：
 *   node src/scripts/seed-test-users.js          # 创建/更新测试账号
 *   node src/scripts/seed-test-users.js --clean  # 删除所有测试账号
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const { hashPassword } = require('../utils/password');

const TEST_PASSWORD = 'Test@1234';

const TEST_ACCOUNTS = [
  {
    phone: '13800000001',
    name: '测试一线',
    roles: ['FRONTLINE'],
    area: '太和东服务中心',
    gridName: '太和东服务中心',
    staffType: '测试账号'
  },
  {
    phone: '13800000002',
    name: '测试网格经理',
    roles: ['GRID_MANAGER'],
    area: '太和东服务中心',
    gridName: '太和东服务中心',
    staffType: '测试账号'
  },
  {
    phone: '13800000003',
    name: '测试网络支撑',
    roles: ['NETWORK_MANAGER'],
    area: '太和东服务中心',
    gridName: '',
    staffType: '测试账号'
  },
  {
    phone: '13800000004',
    name: '测试设计',
    roles: ['DESIGN'],
    area: '太和东服务中心',
    gridName: '',
    feishuId: 'test_feishu_design',
    staffType: '测试账号'
  },
  {
    phone: '13800000005',
    name: '测试施工',
    roles: ['CONSTRUCTION'],
    area: '太和东服务中心',
    gridName: '',
    feishuId: 'test_feishu_construction',
    staffType: '测试账号'
  },
  {
    phone: '13800000006',
    name: '测试监理',
    roles: ['SUPERVISOR'],
    area: '太和东服务中心',
    gridName: '',
    staffType: '测试账号'
  },
  {
    phone: '13800000007',
    name: '测试管理员',
    roles: ['ADMIN'],
    area: '',
    gridName: '',
    staffType: '测试账号'
  },
  {
    phone: '13800000008',
    name: '测试跨区一线',
    roles: ['FRONTLINE'],
    area: '金华服务中心',
    gridName: '金华服务中心',
    staffType: '测试账号'
  }
];

async function seedTestUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const hashedPwd = await hashPassword(TEST_PASSWORD);

  for (const account of TEST_ACCOUNTS) {
    const existing = await User.findOne({ phone: account.phone });
    if (existing) {
      // 更新已有账号
      existing.name = account.name;
      existing.roles = account.roles;
      existing.area = account.area;
      existing.gridName = account.gridName;
      existing.staffType = account.staffType;
      if (account.feishuId) existing.feishuId = account.feishuId;
      existing.active = true;
      if (!existing.password) {
        existing.password = hashedPwd;
        existing.passwordChanged = true;
      }
      await existing.save();
      console.log(`  ✅ 已更新：${account.name}（${account.phone}）`);
    } else {
      await User.create({
        ...account,
        password: hashedPwd,
        passwordChanged: true,
        active: true
      });
      console.log(`  ✅ 已创建：${account.name}（${account.phone}）`);
    }
  }

  console.log(`\n全部测试账号已就绪，统一密码：${TEST_PASSWORD}`);
  console.log('手机号范围：13800000001 ~ 13800000008\n');
}

async function cleanTestUsers() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');

  const phones = TEST_ACCOUNTS.map(a => a.phone);
  const result = await User.deleteMany({ phone: { $in: phones } });
  console.log(`\n已删除测试账号 ${result.deletedCount} 个`);
}

(async () => {
  try {
    const isClean = process.argv.includes('--clean');
    if (isClean) {
      await cleanTestUsers();
    } else {
      await seedTestUsers();
    }
  } catch (err) {
    console.error('执行失败：', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
})();
