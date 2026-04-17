// DEV-ONLY: Remove this file and its app.js mount before production
/**
 * dev-test.js
 * 开发测试专用路由 — 仅在 NODE_ENV !== 'production' 下挂载
 *
 * 端点：
 *   GET  /api/dev/test-accounts   — 返回所有测试账号及凭据
 *   POST /api/dev/quick-login     — 按手机号一键获取 JWT（绕过密码）
 *   POST /api/dev/run-scenario    — 服务端模拟完整工作流，逐步返回结果
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const User = require('../models/user.model');
const Demand = require('../models/demand.model');
const { logger } = require('../utils/logger');

const router = express.Router();

// ─── 测试账号定义 ───────────────────────────────────────────────────
const TEST_PHONES = {
  FRONTLINE:        '13800000001',
  GRID_MANAGER:     '13800000002',
  NETWORK_MANAGER:  '13800000003',
  DESIGN:           '13800000004',
  CONSTRUCTION:     '13800000005',
  SUPERVISOR:       '13800000006',
  ADMIN:            '13800000007',
  FRONTLINE_CROSS:  '13800000008'
};
const TEST_PASSWORD = 'Test@1234';

// ─── 工具函数 ─────────────────────────────────────────────────────────

function makeToken(user) {
  return jwt.sign(
    { userId: user._id, phone: user.phone, role: user.roles[0] || null, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

async function getTestUser(phone) {
  const user = await User.findOne({ phone, active: true });
  if (!user) throw new Error(`测试账号 ${phone} 不存在，请先运行 seed-test-users.js`);
  return user;
}

function buildClient(token) {
  const port = process.env.PORT || 3000;
  const client = axios.create({
    baseURL: `http://localhost:${port}/api`,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 10000
  });
  // 直接返回 data 字段，失败时抛出可读错误
  client.interceptors.response.use(
    res => res.data,
    err => {
      const msg = err.response?.data?.message || err.message;
      throw new Error(msg);
    }
  );
  return client;
}

// 场景步骤执行器：捕获单步错误，不中断整体
async function runStep(steps, label, fn) {
  const start = Date.now();
  try {
    const data = await fn();
    steps.push({ step: label, status: 'pass', detail: data || null, ms: Date.now() - start });
    return data;
  } catch (err) {
    steps.push({ step: label, status: 'fail', detail: err.message, ms: Date.now() - start });
    return null;
  }
}

// ─── 场景实现 ─────────────────────────────────────────────────────────

async function scenarioFull(steps) {
  const frontline   = await getTestUser(TEST_PHONES.FRONTLINE);
  const admin       = await getTestUser(TEST_PHONES.ADMIN);
  const design      = await getTestUser(TEST_PHONES.DESIGN);
  const construction = await getTestUser(TEST_PHONES.CONSTRUCTION);
  const networkMgr  = await getTestUser(TEST_PHONES.NETWORK_MANAGER);

  const cFrontline  = buildClient(makeToken(frontline));
  const cAdmin      = buildClient(makeToken(admin));
  const cDesign     = buildClient(makeToken(design));
  const cConstr     = buildClient(makeToken(construction));
  const cNetwork    = buildClient(makeToken(networkMgr));

  let demandId;

  // Step 1: 创建工单
  const created = await runStep(steps, '【FRONTLINE】创建工单', async () => {
    const res = await cFrontline.post('/demand/create', {
      acceptArea: '太和东服务中心',
      demandPersonName: '测试客户',
      demandPersonPhone: '13900000099',
      businessType: '家宽',
      demandType: '新建',
      reservedCustomers: 5,
      dpBoxCount: 2,
      locationDetail: '射洪市太和镇测试路1号',
      urgency: '普通'
    });
    demandId = res.data?.id;
    return { demandNo: res.data?.demandNo, demandId };
  });
  if (!demandId) return; // 无法继续

  // Step 2: 管理员指派设计单位（因无 AreaConfig，工单为待审核）
  await runStep(steps, '【ADMIN】指派设计单位', async () => {
    await cAdmin.post('/intervene/reassign', {
      demandId,
      unitType: 'design',
      userId: String(design._id)
    });
    await cAdmin.post('/intervene/reassign', {
      demandId,
      unitType: 'construction',
      userId: String(construction._id)
    });
    return { assignedDesign: design.name, assignedConstruction: construction.name };
  });

  // Step 3: 设计单位提交查勘（无资源）
  await runStep(steps, '【DESIGN】提交查勘结果', async () => {
    await cDesign.post('/design/submit', {
      demandId,
      hasResource: false,
      designFiles: ['https://placeholder.test/auto-design.jpg'],
      remark: '自动化测试-设计完成'
    });
    return { hasResource: false };
  });

  // Step 4: 施工单位确认开工
  await runStep(steps, '【CONSTRUCTION】确认开工', async () => {
    await cConstr.post('/construction/start', { demandId });
    return {};
  });

  // Step 5: 施工单位提交竣工
  await runStep(steps, '【CONSTRUCTION】提交竣工资料', async () => {
    await cConstr.post('/construction/submit', {
      demandId,
      coverageName: '测试覆盖点',
      assetStatus: '已生效',
      photos: [],
      remark: '自动化测试-施工完成'
    });
    return {};
  });

  // Step 6: 管理员确认开通（测试账号非 AreaConfig 指定经理，用 ADMIN 绕过区域校验）
  await runStep(steps, '【ADMIN】确认开通', async () => {
    await cAdmin.post('/intervene/confirm', {
      demandId,
      action: 'approve'
    });
    return {};
  });

  // Step 7: 验证最终状态
  await runStep(steps, '验证工单状态为已开通', async () => {
    const demand = await Demand.findById(demandId).select('status demandNo').lean();
    if (demand.status !== '已开通') throw new Error(`状态异常：${demand.status}`);
    return { status: demand.status };
  });

  return demandId;
}

async function scenarioCrossArea(steps) {
  const crossFrontline = await getTestUser(TEST_PHONES.FRONTLINE_CROSS);
  const gridMgr        = await getTestUser(TEST_PHONES.GRID_MANAGER);
  const admin          = await getTestUser(TEST_PHONES.ADMIN);
  const design         = await getTestUser(TEST_PHONES.DESIGN);
  const construction   = await getTestUser(TEST_PHONES.CONSTRUCTION);
  const networkMgr     = await getTestUser(TEST_PHONES.NETWORK_MANAGER);

  const cCross    = buildClient(makeToken(crossFrontline));
  const cGrid     = buildClient(makeToken(gridMgr));
  const cAdmin    = buildClient(makeToken(admin));
  const cDesign   = buildClient(makeToken(design));
  const cConstr   = buildClient(makeToken(construction));
  const cNetwork  = buildClient(makeToken(networkMgr));

  let demandId;

  // Step 1: 跨区域一线创建工单（金华 → 太和东）
  const created = await runStep(steps, '【FRONTLINE跨区】创建跨区域工单', async () => {
    const res = await cCross.post('/demand/create', {
      acceptArea: '太和东服务中心',
      demandPersonName: '跨区测试客户',
      demandPersonPhone: '13900000088',
      businessType: '家宽',
      demandType: '新建',
      reservedCustomers: 3,
      dpBoxCount: 1,
      locationDetail: '射洪市太和镇跨区测试路2号',
      urgency: '普通'
    });
    demandId = res.data?.id;
    return { demandNo: res.data?.demandNo };
  });
  if (!demandId) return;

  // Step 2: 将 crossAreaReviewerId 指向测试 GRID_MANAGER
  // 业务逻辑按提交人 gridName（金华服务中心）找审核人，但测试账号无该网格的 GRID_MANAGER，
  // 直接修 DB 模拟已正确配置的状态
  await Demand.findByIdAndUpdate(demandId, { crossAreaReviewerId: gridMgr._id });

  // Step 3: 网格经理审核通过
  await runStep(steps, '【GRID_MANAGER】跨区域审核通过', async () => {
    await cGrid.post('/demand/cross-area-review', {
      demandId,
      approve: true,
      note: '自动化测试-审核通过'
    });
    return {};
  });

  // Step 4: 管理员指派设计/施工
  await runStep(steps, '【ADMIN】指派设计/施工单位', async () => {
    await cAdmin.post('/intervene/reassign', { demandId, unitType: 'design', userId: String(design._id) });
    await cAdmin.post('/intervene/reassign', { demandId, unitType: 'construction', userId: String(construction._id) });
    return {};
  });

  // Step 5: 设计提交
  await runStep(steps, '【DESIGN】提交查勘结果', async () => {
    await cDesign.post('/design/submit', { demandId, hasResource: false, designFiles: ['https://placeholder.test/auto-design.jpg'], remark: '跨区测试' });
    return {};
  });

  // Step 6: 施工提交
  await runStep(steps, '【CONSTRUCTION】提交竣工资料', async () => {
    await cConstr.post('/construction/start', { demandId });
    await cConstr.post('/construction/submit', {
      demandId, coverageName: '跨区测试点', assetStatus: '已生效', photos: []
    });
    return {};
  });

  // Step 7: 确认开通（测试账号非 AreaConfig 指定经理，用 ADMIN 绕过区域校验）
  await runStep(steps, '【ADMIN】确认开通', async () => {
    await cAdmin.post('/intervene/confirm', { demandId, action: 'approve' });
    return {};
  });

  // Step 8: 验证
  await runStep(steps, '验证工单状态为已开通', async () => {
    const d = await Demand.findById(demandId).select('status').lean();
    if (d.status !== '已开通') throw new Error(`状态异常：${d.status}`);
    return { status: d.status };
  });

  return demandId;
}

async function scenarioRejectResubmit(steps) {
  const frontline = await getTestUser(TEST_PHONES.FRONTLINE);
  const admin     = await getTestUser(TEST_PHONES.ADMIN);
  const design    = await getTestUser(TEST_PHONES.DESIGN);
  const cFrontline = buildClient(makeToken(frontline));
  const cAdmin     = buildClient(makeToken(admin));
  const cDesign    = buildClient(makeToken(design));

  let demandId;

  await runStep(steps, '【FRONTLINE】创建工单', async () => {
    const res = await cFrontline.post('/demand/create', {
      acceptArea: '太和东服务中心',
      demandPersonName: '驳回测试客户',
      demandPersonPhone: '13900000077',
      businessType: '家宽',
      demandType: '新建',
      reservedCustomers: 2,
      dpBoxCount: 1,
      locationDetail: '射洪市太和镇驳回测试路3号',
      urgency: '普通'
    });
    demandId = res.data?.id;
    return { demandNo: res.data?.demandNo };
  });
  if (!demandId) return;

  await runStep(steps, '【ADMIN】指派设计单位', async () => {
    await cAdmin.post('/intervene/reassign', { demandId, unitType: 'design', userId: String(design._id) });
    return {};
  });

  await runStep(steps, '【DESIGN】驳回工单', async () => {
    await cDesign.post('/demand/reject', {
      demandId,
      reason: '自动化测试-驳回',
      rejectType: '其他'
    });
    return {};
  });

  await runStep(steps, '验证状态为已驳回', async () => {
    const d = await Demand.findById(demandId).select('status').lean();
    if (d.status !== '已驳回') throw new Error(`状态异常：${d.status}`);
    return { status: d.status };
  });

  await runStep(steps, '【FRONTLINE】重新提交工单', async () => {
    await cFrontline.post('/demand/update', { id: demandId, resubmit: true });
    return {};
  });

  await runStep(steps, '验证状态为设计中（重提后）', async () => {
    const d = await Demand.findById(demandId).select('status').lean();
    if (d.status !== '设计中') throw new Error(`状态异常：${d.status}`);
    return { status: d.status };
  });

  return demandId;
}

async function scenarioTimeoutRemind(steps) {
  const admin      = await getTestUser(TEST_PHONES.ADMIN);
  const design     = await getTestUser(TEST_PHONES.DESIGN);
  const networkMgr = await getTestUser(TEST_PHONES.NETWORK_MANAGER);
  const cAdmin     = buildClient(makeToken(admin));
  const cNetwork   = buildClient(makeToken(networkMgr));

  let demandId;

  // remind 接口要求 assignedDesignUnit 有 feishuId，给测试账号设一个占位值
  await User.updateOne({ _id: design._id }, { $set: { feishuId: 'test_feishu_design' } });

  // 直接构造一个已超时的设计中工单（设计指派时间设为 3 天前）
  await runStep(steps, '构造超时测试工单（设计中 3天前指派）', async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const Counter = require('../models/counter.model');
    const seq = await Counter.findOneAndUpdate(
      { _id: 'demand_test' },
      { $inc: { seq: 1 } },
      { upsert: true, new: true }
    );
    const demandNo = `R-TEST-${String(seq.seq).padStart(4, '0')}`;
    const demand = await Demand.create({
      demandNo,
      acceptArea: '太和东服务中心',
      demandPersonName: '超时测试客户',
      demandPersonPhone: '13900000066',
      businessType: '家宽',
      type: '新建',
      locationDetail: '射洪市太和镇超时测试路4号',
      status: '设计中',
      designAssignTime: threeDaysAgo,
      assignedDesignUnit: design._id,
      createdBy: admin._id,
      gridName: '太和东服务中心',
      logs: [{ content: '自动化测试-超时工单', operatorName: '系统' }]
    });
    demandId = String(demand._id);
    return { demandNo, demandId };
  });
  if (!demandId) return;

  // 管理员发催办
  await runStep(steps, '【ADMIN】发送催办提醒', async () => {
    await cAdmin.post('/timeout/remind', { demandId });
    return {};
  });

  // 验证催办消息是否写入数据库
  await runStep(steps, '验证站内催办消息已创建', async () => {
    const Message = require('../models/message.model');
    const msg = await Message.findOne({ demandId, type: 'remind' }).lean();
    if (!msg) throw new Error('未找到催办站内消息');
    return { to: msg.recipientId };
  });

  return demandId;
}

// ─── API 端点 ─────────────────────────────────────────────────────────

/**
 * GET /api/dev/test-accounts
 * 无需认证
 */
router.get('/dev/test-accounts', async (req, res, next) => {
  try {
    const phones = Object.values(TEST_PHONES);
    const users = await User.find({ phone: { $in: phones } })
      .select('name phone roles area gridName active')
      .lean();
    const userMap = Object.fromEntries(users.map(u => [u.phone, u]));

    const accounts = [
      { label: '一线人员',       phone: TEST_PHONES.FRONTLINE,       roles: ['FRONTLINE'] },
      { label: '网格经理',       phone: TEST_PHONES.GRID_MANAGER,    roles: ['GRID_MANAGER'] },
      { label: '网络支撑经理',   phone: TEST_PHONES.NETWORK_MANAGER, roles: ['NETWORK_MANAGER'] },
      { label: '设计单位',       phone: TEST_PHONES.DESIGN,          roles: ['DESIGN'] },
      { label: '施工单位',       phone: TEST_PHONES.CONSTRUCTION,    roles: ['CONSTRUCTION'] },
      { label: '监理单位',       phone: TEST_PHONES.SUPERVISOR,      roles: ['SUPERVISOR'] },
      { label: '管理员',         phone: TEST_PHONES.ADMIN,           roles: ['ADMIN'] },
      { label: '跨区域一线',     phone: TEST_PHONES.FRONTLINE_CROSS, roles: ['FRONTLINE'], note: 'gridName: 金华服务中心' }
    ].map(a => ({
      ...a,
      password: TEST_PASSWORD,
      name: userMap[a.phone]?.name || '（未创建）',
      area: userMap[a.phone]?.area || '',
      gridName: userMap[a.phone]?.gridName || '',
      exists: !!userMap[a.phone],
      active: userMap[a.phone]?.active ?? false,
      userId: userMap[a.phone]?._id || null
    }));

    res.json({ code: 0, data: accounts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dev/quick-login
 * 无需认证；body: { phone: string }
 */
router.post('/dev/quick-login', async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.json({ code: 1, message: '缺少 phone 参数' });

    const user = await User.findOne({ phone, active: true });
    if (!user) {
      return res.json({ code: 1, message: `账号 ${phone} 不存在，请先运行 seed-test-users.js` });
    }

    const token = makeToken(user);
    res.json({
      code: 0,
      data: {
        token,
        userInfo: {
          _id: user._id,
          id: String(user._id),
          name: user.name,
          phone: user.phone,
          role: user.roles[0] || null,
          roles: user.roles,
          area: user.area || '',
          gridName: user.gridName || '',
          passwordChanged: user.passwordChanged || false
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/dev/run-scenario
 * 需要 Authorization header（ADMIN token）
 * body: { scenario: 'full' | 'cross_area' | 'reject_resubmit' | 'timeout_remind' }
 */
router.post('/dev/run-scenario', async (req, res, next) => {
  // 简单 token 校验（不走完整 authenticate 中间件，避免循环依赖）
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ code: 401, message: '需要认证' });

  const { scenario } = req.body;
  const validScenarios = ['full', 'cross_area', 'reject_resubmit', 'timeout_remind'];
  if (!validScenarios.includes(scenario)) {
    return res.json({ code: 1, message: `无效场景，可选：${validScenarios.join(' | ')}` });
  }

  const steps = [];
  let demandId = null;
  const start = Date.now();

  try {
    if (scenario === 'full')             demandId = await scenarioFull(steps);
    if (scenario === 'cross_area')       demandId = await scenarioCrossArea(steps);
    if (scenario === 'reject_resubmit')  demandId = await scenarioRejectResubmit(steps);
    if (scenario === 'timeout_remind')   demandId = await scenarioTimeoutRemind(steps);
  } catch (err) {
    steps.push({ step: '场景执行异常', status: 'fail', detail: err.message, ms: 0 });
  }

  // 清理本次产生的测试工单
  if (demandId) {
    try {
      await Demand.findByIdAndUpdate(demandId, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedByName: 'DEV_TEST',
          deleteReason: '测试场景自动清理'
        }
      });
    } catch {
      // 清理失败不影响结果
    }
  }

  const passed = steps.filter(s => s.status === 'pass').length;
  const failed = steps.filter(s => s.status === 'fail').length;

  logger.info('测试场景执行完毕', { scenario, passed, failed, totalMs: Date.now() - start });
  res.json({ code: 0, data: { scenario, steps, passed, failed, totalMs: Date.now() - start } });
});

module.exports = router;
