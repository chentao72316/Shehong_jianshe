const mongoose = require('mongoose');

// 原子计数器，用于生成连续工单编号
// _id 格式：demand_YYYYMMDD，每天独立计数，从 1 开始
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);
