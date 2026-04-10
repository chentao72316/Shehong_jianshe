const express = require('express');
const jwt = require('jsonwebtoken');
const { code2Session } = require('../utils/wx');
const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { rateLimitLogin, recordFailedLogin, resetFailedLogin } = require('../middleware/rate-limit');
const User = require('../models/user.model');
const { createError } = require('../middleware/error-handler');
const { logger } = require('../utils/logger');
const { canPcLogin, getPrimaryRole } = require('../utils/pc-access');

const router = express.Router();

// ─── 辅助函数 ───────────────────────────────────────────────────────

/**
 * 获取登录后的响应数据
 */
function buildLoginResponse(user, extraData = {}) {
  const primaryRole = getPrimaryRole(user);
  const token = jwt.sign(
    { userId: user._id, phone: user.phone, role: user.roles[0] || null, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
  return {
    code: 0,
    data: {
      token,
      userInfo: {
        id: String(user._id),
        name: user.name,
        phone: user.phone,
        role: primaryRole,
        roles: user.roles,
        district: user.district,
        area: user.area,
        gridName: user.gridName,
        feishuId: user.feishuId,
        passwordChanged: user.passwordChanged || false,
        canPcLogin: canPcLogin(user),
        pcRole: primaryRole,
        ...extraData
      }
    }
  };
}

/**
 * 检查账户是否被锁定
 */
function checkAccountLock(user) {
  if (user.lockUntil && new Date() < user.lockUntil) {
    const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
    throw createError(423, `账号已锁定，请${remaining}分钟后再试`);
  }
}

/**
 * 更新最后登录信息
 */
async function updateLoginInfo(user, ip) {
  user.lastLoginAt = new Date();
  user.lastLoginIp = ip || null;
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();
}

/**
 * 记录登录失败并抛出或返回错误
 * 密码连续错误 5 次后锁定账号 15 分钟
 */
async function recordLoginFailure(user, phone) {
  user.loginAttempts = (user.loginAttempts || 0) + 1;
  if (user.loginAttempts >= 5) {
    user.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    logger.warn('账号已被锁定', { phone, userId: user._id, attempts: user.loginAttempts });
    throw createError(423, '连续5次密码错误，账号已锁定15分钟');
  }
  await user.save();
  recordFailedLogin(phone);
  logger.warn('登录失败：密码错误', { phone, userId: user._id, attempts: user.loginAttempts });
}

// ─── 手机号 + 密码登录 ───────────────────────────────────────────────

/**
 * POST /api/auth/phone-password
 * 手机号 + 密码登录（正式生产入口）
 * Body: { phone: string, password: string }
 */
router.post('/auth/phone-password', rateLimitLogin, async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    // ─── 输入校验 ───
    if (!phone) throw createError(400, '请输入手机号');
    if (!/^1[3-9]\d{9}$/.test(phone)) throw createError(400, '手机号格式不正确');
    if (!password) throw createError(400, '请输入密码');

    // ─── 查找用户 ───
    const user = await User.findOne({ phone });
    if (!user) {
      logger.warn('登录失败：用户不存在', { phone, ip: req.ip });
      return res.status(401).json({ code: 401, message: '手机号或密码错误' });
    }
    if (!user.active) {
      logger.warn('登录失败：账号已被禁用', { phone, userId: user._id });
      throw createError(403, '账号已被禁用，请联系管理员');
    }

    // ─── 账户锁定检查 ───
    checkAccountLock(user);

    // ─── 密码验证 ───
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      await recordLoginFailure(user, phone);
      return res.status(401).json({ code: 401, message: '手机号或密码错误' });
    }

    // ─── 登录成功 ───
    await updateLoginInfo(user, req.ip);
    resetFailedLogin(phone);
    logger.info('手机号+密码登录成功', { userId: user._id, phone, ip: req.ip });

    const needPasswordChange = !user.passwordChanged;
    res.json(buildLoginResponse(user, { needPasswordChange }));
  } catch (err) { next(err); }
});

// ─── 微信一键登录 ──────────────────────────────────────────────────

/**
 * POST /api/auth/wx-bind
 * 微信一键登录（openid 绑定模式）
 * Body: { loginCode: string }
 *
 * 流程：
 * 1. 用 loginCode 换取 openid
 * 2. 按 openid 查找已绑定用户 → 存在则直接登录
 * 3. openid 未绑定 → 返回 needBind=true，引导绑定手机号
 */
router.post('/auth/wx-bind', async (req, res, next) => {
  try {
    const { loginCode } = req.body;
    if (!loginCode) throw createError(400, '缺少登录参数');

    // 用 loginCode 换取 openid
    const openid = await code2Session(loginCode);

    // 按 openid 查找已绑定用户
    const user = await User.findOne({ openid, active: true });
    if (user) {
      // 已绑定用户，直接登录
      checkAccountLock(user);
      await updateLoginInfo(user, req.ip);
      logger.info('微信一键登录成功（已绑定）', { userId: user._id, phone: user.phone, ip: req.ip });

      const needPasswordChange = !user.passwordChanged;
      return res.json(buildLoginResponse(user, { needPasswordChange }));
    }

    // openid 未绑定，签发临时 bindToken
    const bindToken = jwt.sign(
      { purpose: 'wx-bind', openid },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    logger.info('微信登录需要绑定手机号', { openid, ip: req.ip });
    res.json({
      code: 0,
      data: {
        needBind: true,
        bindToken
      }
    });
  } catch (err) { next(err); }
});

// ─── 绑定手机号 ────────────────────────────────────────────────────

/**
 * POST /api/auth/bind-phone
 * 通过 bindToken 绑定手机号并完成登录
 * Body: { bindToken: string, phone: string, password: string }
 *
 * 流程：
 * 1. 验证 bindToken 有效性
 * 2. 验证手机号存在且 active
 * 3. 验证密码正确
 * 4. 将 openid 绑定到该用户
 * 5. 签发正式 JWT
 */
router.post('/auth/bind-phone', async (req, res, next) => {
  try {
    const { bindToken, phone, password } = req.body;

    // ─── 输入校验 ───
    if (!bindToken) throw createError(400, '缺少绑定凭证');
    if (!phone) throw createError(400, '请输入手机号');
    if (!/^1[3-9]\d{9}$/.test(phone)) throw createError(400, '手机号格式不正确');
    if (!password) throw createError(400, '请输入密码');

    // ─── 验证 bindToken ───
    let payload;
    try {
      payload = jwt.verify(bindToken, process.env.JWT_SECRET);
    } catch (e) {
      throw createError(401, '绑定凭证已过期，请重新点击微信登录');
    }
    if (payload.purpose !== 'wx-bind') throw createError(401, '无效的绑定凭证');
    const { openid } = payload;

    // ─── 查找用户 ───
    const user = await User.findOne({ phone });
    if (!user) throw createError(401, '手机号或密码错误');
    if (!user.active) throw createError(403, '账号已被禁用，请联系管理员');

    // ─── 账户锁定检查 ───
    checkAccountLock(user);

    // ─── 密码验证 ───
    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      await recordLoginFailure(user, phone);
      return res.status(401).json({ code: 401, message: '手机号或密码错误' });
    }

    // ─── 检查 openid 是否已被其他用户绑定 ───
    const existingUser = await User.findOne({ openid });
    if (existingUser && String(existingUser._id) !== String(user._id)) {
      throw createError(409, '此微信已被其他账号绑定');
    }

    // ─── 绑定 openid ───
    user.openid = openid;
    await updateLoginInfo(user, req.ip);
    resetFailedLogin(phone);

    logger.info('微信手机号绑定成功', { userId: user._id, phone, openid, ip: req.ip });

    const needPasswordChange = !user.passwordChanged;
    res.json(buildLoginResponse(user, { needPasswordChange }));
  } catch (err) { next(err); }
});

// ─── 改造原有 /api/login（向后兼容小程序前端）───────────────────────

/**
 * POST /api/login
 * 兼容处理：
 * - 如果传了 loginCode → 执行微信一键登录（wx-bind 逻辑）
 * - 如果传了 phone + password → 执行手机号密码登录
 *
 * 小程序前端目前传入 loginCode，故走 wx-bind 逻辑
 */
router.post('/login', rateLimitLogin, async (req, res, next) => {
  try {
    const { loginCode, phone, password } = req.body;

    // 如果是手机号+密码登录
    if (phone !== undefined && password !== undefined) {
      if (!/^1[3-9]\d{9}$/.test(phone)) throw createError(400, '手机号格式不正确');
      const user = await User.findOne({ phone });
      if (!user) return res.status(401).json({ code: 401, message: '手机号或密码错误' });
      if (!user.active) throw createError(403, '账号已被禁用');
      checkAccountLock(user);
      const isMatch = await comparePassword(password, user.password);
      if (!isMatch) {
        await recordLoginFailure(user, phone);
        return res.status(401).json({ code: 401, message: '手机号或密码错误' });
      }
      await updateLoginInfo(user, req.ip);
      resetFailedLogin(phone);
      logger.info('手机号+密码登录成功（兼容入口）', { userId: user._id, phone, ip: req.ip });
      return res.json(buildLoginResponse(user));
    }

    // 微信一键登录
    if (!loginCode) throw createError(400, '缺少登录参数');
    const openid = await code2Session(loginCode);
    const user = await User.findOne({ openid, active: true });
    if (user) {
      checkAccountLock(user);
      await updateLoginInfo(user, req.ip);
      logger.info('微信一键登录成功（兼容入口）', { userId: user._id, phone: user.phone });
      return res.json(buildLoginResponse(user));
    }

    // 未绑定，签发 bindToken
    const bindToken = jwt.sign(
      { purpose: 'wx-bind', openid },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.json({ code: 0, data: { needBind: true, bindToken } });
  } catch (err) { next(err); }
});

// ─── 需要认证的路由 ────────────────────────────────────────────────

const { authenticate, requireRole } = require('../middleware/auth');

/**
 * GET /api/user/role
 * 获取当前用户角色列表
 */
router.get('/user/role', authenticate, async (req, res) => {
  res.json({
    code: 0,
    data: {
      roles: req.user.roles,
      userInfo: {
        id: String(req.user._id),
        name: req.user.name,
        phone: req.user.phone,
        district: req.user.district,
        area: req.user.area,
        gridName: req.user.gridName,
        canPcLogin: canPcLogin(req.user),
        pcRole: getPrimaryRole(req.user),
        passwordChanged: req.user.passwordChanged || false
      }
    }
  });
});

/**
 * POST /api/auth/reset-password
 * 管理员重置用户密码（仅 ADMIN 角色）
 * Body: { userId: string, newPassword: string }
 */
router.post('/auth/reset-password', authenticate, requireRole('ADMIN', 'DISTRICT_MANAGER'), async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;
    if (!userId) throw createError(400, '缺少 userId 参数');
    if (!newPassword) throw createError(400, '请输入新密码');

    // 管理员设置初始密码，规则宽松
    const check = validatePasswordStrength(newPassword, true);
    if (!check.valid) throw createError(400, check.message);

    const user = await User.findById(userId);
    if (!user) throw createError(404, '用户不存在');
    const isAdmin = (req.user.roles || []).includes('ADMIN');
    if (!isAdmin) {
      if ((user.roles || []).includes('ADMIN')) throw createError(403, '无权限重置管理员密码');
      if ((user.district || '射洪市') !== (req.user.district || '射洪市')) {
        throw createError(403, '仅可重置本区县人员密码');
      }
    }

    user.password = await hashPassword(newPassword);
    // 管理员重置后，用户下次登录不需要强制修改（因为已经是新密码了）
    await user.save();

    logger.info('管理员重置用户密码', { adminId: String(req.user._id), adminPhone: req.user.phone, targetUserId: userId });
    res.json({ code: 0, message: '密码重置成功' });
  } catch (err) { next(err); }
});

/**
 * POST /api/auth/change-password
 * 用户自行修改密码（需 Bearer Token）
 * Body: { oldPassword: string, newPassword: string }
 */
router.post('/auth/change-password', authenticate, async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword) throw createError(400, '请输入原密码');
    if (!newPassword) throw createError(400, '请输入新密码');

    // 用户修改密码需满足完整强度要求
    const check = validatePasswordStrength(newPassword, false);
    if (!check.valid) throw createError(400, check.message);

    const user = await User.findById(req.user._id);
    if (!user) throw createError(404, '用户不存在');

    // 验证原密码（首次设置密码时 user.password 为 null，跳过验证）
    if (user.password !== null) {
      const isMatch = await comparePassword(oldPassword, user.password);
      if (!isMatch) throw createError(401, '原密码错误');
      // 不能与原密码相同
      const sameAsOld = await comparePassword(newPassword, user.password);
      if (sameAsOld) throw createError(400, '新密码不能与原密码相同');
    }

    user.password = await hashPassword(newPassword);
    user.passwordChanged = true;
    user.passwordChangedAt = new Date();
    await user.save();

    logger.info('用户修改密码成功', { userId: String(req.user._id), phone: req.user.phone });
    res.json({ code: 0, message: '密码修改成功' });
  } catch (err) { next(err); }
});

module.exports = router;
