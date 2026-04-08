const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // ─── 基础信息 ───
  openid: { type: String, sparse: true, unique: true },
  phone: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  roles: [{
    type: String,
    enum: ['FRONTLINE', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR', 'ADMIN', 'GRID_MANAGER', 'NETWORK_MANAGER']
  }],
  district: { type: String, default: '射洪市' },  // 所属区县
  area: { type: String },
  gridName: { type: String },
  wxAccount: { type: String },
  employeeId: { type: String },
  staffType: { type: String },
  feishuId: { type: String },
  active: { type: Boolean, default: true },

  // ─── 密码与认证 ───
  // bcrypt 加密存储，null 表示未设置密码（仅开放手机号+密码登录后才有值）
  password: { type: String, default: null },
  // 密码是否已由用户修改过（首次登录后强制修改）
  passwordChanged: { type: Boolean, default: false },
  // 密码最后修改时间
  passwordChangedAt: { type: Date, default: null },

  // ─── 登录安全 ───
  // 连续登录失败次数
  loginAttempts: { type: Number, default: 0 },
  // 账户锁定截止时间
  lockUntil: { type: Date, default: null },
  // 最后登录时间
  lastLoginAt: { type: Date, default: null },
  // 最后登录 IP
  lastLoginIp: { type: String, default: null }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
