const { logger } = require('../utils/logger');

/**
 * 统一错误处理中间件
 * 捕获所有路由未处理的错误，返回标准 JSON 格式
 */
function errorHandler(err, req, res, next) {
  // 记录错误日志（系统错误需包含堆栈）
  if (err.status && err.status < 500) {
    logger.warn('业务错误', { path: req.path, message: err.message });
  } else {
    logger.error('系统错误', { path: req.path, message: err.message, stack: err.stack });
  }

  // 验证错误
  if (err.name === 'ValidationError') {
    const errors = Object.fromEntries(
      Object.entries(err.errors).map(([k, v]) => [k, v.message])
    );
    return res.status(400).json({ code: 400, message: '参数验证失败', errors });
  }

  // MongoDB 唯一约束冲突
  if (err.code === 11000) {
    return res.status(409).json({ code: 409, message: '数据已存在，请勿重复提交' });
  }

  // JWT 错误（已在auth中间件处理，此处兜底）
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ code: 401, message: '认证失败，请重新登录' });
  }

  // 业务错误（主动抛出的带 status 的错误）
  if (err.status) {
    return res.status(err.status).json({ code: err.status, message: err.message });
  }

  // 兜底：系统错误，不暴露内部细节
  return res.status(500).json({ code: 500, message: '服务器内部错误，请稍后重试' });
}

/**
 * 创建业务错误（带 HTTP status）
 */
function createError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { errorHandler, createError };
