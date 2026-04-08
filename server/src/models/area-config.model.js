const mongoose = require('mongoose');

const areaConfigSchema = new mongoose.Schema({
  district: { type: String, required: true, default: '射洪市' },  // 所属区县
  acceptArea: { type: String, required: true },                   // 受理区域名称
  networkCenter: { type: String, default: '' },                // 所属网络支撑中心
  designCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  constructionCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  supervisorCandidates: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  networkManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  active: { type: Boolean, default: true }
}, { timestamps: true });

// 同一区县内受理区域名称唯一
areaConfigSchema.index({ district: 1, acceptArea: 1 }, { unique: true });

module.exports = mongoose.model('AreaConfig', areaConfigSchema);
