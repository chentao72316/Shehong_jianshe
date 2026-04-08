const { createError } = require('./error-handler');

// ─── 基于内存的简单限流（单机部署够用）───────────────────────────────
// 生产环境建议改用 Redis

const IP_LIMIT = {};       // { ip: { count, firstAttempt } }
const USER_LOCK = {};      // { phone: { attempts, lockUntil } }

const IP_WINDOW_MS = 15 * 60 * 1000;       // 15 分钟窗口
const MAX_IP_ATTEMPTS = 10;                // 每 IP 每窗口最多尝试次数
const MAX_FAIL_PER_USER = 5;                // 同一手机号最多失败次数
const LOCK_DURATION_MS = 15 * 60 * 1000;    // 锁定 15 分钟

/**
 * 登录限流中间件
 * 在 /api/auth/* 路由上使用
 */
function rateLimitLogin(req, res, next) {
  const ip = (req.ip || req.connection.remoteAddress || '').replace(/^.*:/, '');

  // ─── IP 级别限流 ───
  const now = Date.now();
  if (!IP_LIMIT[ip]) {
    IP_LIMIT[ip] = { count: 0, firstAttempt: now };
  }
  if (now - IP_LIMIT[ip].firstAttempt > IP_WINDOW_MS) {
    IP_LIMIT[ip] = { count: 1, firstAttempt: now };
  } else {
    IP_LIMIT[ip].count++;
    if (IP_LIMIT[ip].count > MAX_IP_ATTEMPTS) {
      return next(createError(429, '登录尝试过于频繁，请15分钟后再试'));
    }
  }

  // ─── 手机号锁定检查 ───
  const phone = req.body && req.body.phone;
  if (phone && USER_LOCK[phone]) {
    if (now < USER_LOCK[phone].lockUntil) {
      const remaining = Math.ceil((USER_LOCK[phone].lockUntil - now) / 60000);
      return next(createError(423, `账号已锁定，请${remaining}分钟后再试`));
    }
    delete USER_LOCK[phone];
  }

  next();
}

/**
 * 记录登录失败
 * @param {string} phone 手机号
 */
function recordFailedLogin(phone) {
  if (!USER_LOCK[phone]) {
    USER_LOCK[phone] = { attempts: 0, lockUntil: null };
  }
  USER_LOCK[phone].attempts++;
  if (USER_LOCK[phone].attempts >= MAX_FAIL_PER_USER) {
    USER_LOCK[phone].lockUntil = Date.now() + LOCK_DURATION_MS;
  }
}

/**
 * 重置登录失败计数（登录成功后调用）
 * @param {string} phone 手机号
 */
function resetFailedLogin(phone) {
  delete USER_LOCK[phone];
}

/**
 * 清理过期数据（定时调用，防止内存泄漏）
 */
function cleanupExpired() {
  const now = Date.now();
  // 清理过期的 IP 记录
  for (const ip of Object.keys(IP_LIMIT)) {
    if (now - IP_LIMIT[ip].firstAttempt > IP_WINDOW_MS) {
      delete IP_LIMIT[ip];
    }
  }
  // 清理过期的锁定记录
  for (const phone of Object.keys(USER_LOCK)) {
    if (USER_LOCK[phone].lockUntil && now > USER_LOCK[phone].lockUntil) {
      delete USER_LOCK[phone];
    }
  }
}

// 每小时清理一次
setInterval(cleanupExpired, 60 * 60 * 1000);

module.exports = { rateLimitLogin, recordFailedLogin, resetFailedLogin };
