const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

/**
 * 加密密码
 * @param {string} password 明文密码
 * @returns {Promise<string>} 加密后的哈希
 */
async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 * @param {string} password 明文密码
 * @param {string} hash 加密后的哈希
 * @returns {Promise<boolean>} 是否匹配
 */
async function comparePassword(password, hash) {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/**
 * 验证密码强度
 * @param {string} password 明文密码
 * @param {boolean} isInitial 是否为初始密码（管理员设置），初始密码规则宽松
 * @returns {{ valid: boolean, message?: string }}
 */
function validatePasswordStrength(password, isInitial = false) {
  if (!password) return { valid: false, message: '请输入密码' };
  if (password.length < 8) return { valid: false, message: '密码长度至少8位' };
  if (!isInitial) {
    if (!/[A-Z]/.test(password)) return { valid: false, message: '密码需包含大写字母' };
    if (!/[a-z]/.test(password)) return { valid: false, message: '密码需包含小写字母' };
    if (!/[0-9]/.test(password)) return { valid: false, message: '密码需包含数字' };
  }
  return { valid: true };
}

module.exports = { hashPassword, comparePassword, validatePasswordStrength };
