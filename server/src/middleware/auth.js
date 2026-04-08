const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const { logger } = require('../utils/logger');

/**
 * JWT 认证中间件
 * 验证 Authorization: Bearer <token>，将用户信息注入 req.user
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '未提供认证令牌' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId).lean();
    if (!user || !user.active) {
      return res.status(401).json({ code: 401, message: '用户不存在或已被禁用' });
    }
    // 使用数据库中的用户信息（包含最新角色），不信任 JWT payload 中的角色
    req.user = user;
    next();
  } catch (err) {
    logger.warn('Token验证失败', { error: err.message });
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }
}

/**
 * 角色守卫中间件工厂
 * @param {...string} roles - 允许的角色
 */
function requireRole(...roles) {
  return (req, res, next) => {
    const userRoles = req.user.roles || [];
    const hasRole = roles.some(r => userRoles.includes(r));
    if (!hasRole) {
      return res.status(403).json({ code: 403, message: '无权限执行此操作' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
