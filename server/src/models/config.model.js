const mongoose = require('mongoose');

/**
 * 系统配置表
 * 用于存储可动态调整的系统配置，如服务中心与网络支撑中心的对应关系
 */
const configSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: mongoose.Schema.Types.Mixed,
  label: { type: String },
  description: { type: String },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// key 字段已有 unique: true，会自动创建唯一索引，无需额外定义

module.exports = mongoose.model('Config', configSchema);
