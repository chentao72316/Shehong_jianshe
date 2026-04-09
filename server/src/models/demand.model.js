const mongoose = require('mongoose');

const demandSchema = new mongoose.Schema({
  demandNo: { type: String, required: true, unique: true },
  district: { type: String, default: '射洪市' },  // 所属区县
  // 受理信息
  acceptArea: { type: String, required: true },
  submitterPhone: { type: String },
  demandPersonName: { type: String },
  demandPersonPhone: { type: String, required: true },
  // 需求信息
  businessType: { type: String, required: true, enum: ['家宽', '专线', '无线', '其他'], default: '家宽' },
  type: { type: String, required: true, enum: ['新建', '扩容', '改造', '应急'] },
  reservedCustomers: { type: Number, min: 0, max: 1000 },
  dpBoxCount: { type: Number, min: 0, max: 100 },
  urgency: { type: String, enum: ['普通', '紧急', '特急'], default: '普通' },
  // 位置
  latitude: { type: Number },
  longitude: { type: Number },
  locationDetail: { type: String, required: true },
  // 照片
  photos: [{ type: String }],
  remark: { type: String, default: '' },
  // 状态
  status: {
    type: String,
    required: true,
    enum: ['待审核', '设计中', '施工中', '待确认', '已开通', '已驳回'],
    default: '待审核'
  },
  // 指派信息
  assignedDesignUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedConstructionUnit: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedSupervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // 时间节点
  designAssignTime: { type: Date },
  constructionAssignTime: { type: Date },
  completedTime: { type: Date },
  completionMode: { type: String, enum: ['EXISTING_RESOURCE', 'CONSTRUCTION_BUILD', ''], default: '' },
  // 设计信息
  hasResource: { type: Boolean },
  resourceName: { type: String },
  resourcePhotos: [{ type: String }],
  designFiles: [{ type: String }],
  designRemark: { type: String },
  // 施工信息
  coverageName: { type: String },
  constructionPhotos: [{ type: String }],
  assetStatus: { type: String, enum: ['已生效', '待生效', '未生效'] },
  constructionLat: { type: Number },
  constructionLng: { type: Number },
  constructionLocationDetail: { type: String, default: '' },
  constructionRemark: { type: String },
  // 网格经理确认信息
  confirmBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // 确认人
  confirmTime: { type: Date },                                        // 确认时间
  confirmRejectReason: { type: String },                              // 确认驳回原因
  // 驳回信息
  rejectType: { type: String, enum: ['有资源', '其他'], default: null },  // 驳回类型
  rejectionReason: { type: String },
  rejectionTime: { type: Date },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectCount: { type: Number, default: 0 },  // 驳回次数
  rejectionAcknowledged: { type: Boolean, default: false },  // 提交人已确认驳回
  // 跨区域审核信息
  crossAreaReviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // 负责审核的网格经理
  crossAreaApproveNote: { type: String },                                        // 审核意见
  // 创建者
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // 网格名称（冗余存储，便于查询）
  gridName: { type: String },
  // 所属服务中心和网络支撑中心
  serviceCenter: { type: String },
  networkSupport: { type: String },
  // 监理验收信息
  supervisorPhotos: [{ type: String }],
  supervisorRemark: { type: String },
  supervisorVerifyTime: { type: Date },
  // 历时统计（分钟，终态时写入）
  totalDuration: { type: Number },        // 总历时：completedTime - createdAt
  designDuration: { type: Number },       // 设计历时：constructionAssignTime - designAssignTime
  constructionDuration: { type: Number }, // 施工历时：completedTime - constructionAssignTime
  // 操作日志
  logs: [{
    content: String,
    operatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    operatorName: String,
    createdAt: { type: Date, default: Date.now }
  }],
  // 超时通知去重：记录最近一次超时通知时间，防止每次检查都重复发送
  lastDesignTimeoutNotifyAt: { type: Date },
  lastConstructionTimeoutNotifyAt: { type: Date }
}, {
  timestamps: true
});

// 复合索引，支持常见查询
demandSchema.index({ status: 1, createdAt: -1 });
demandSchema.index({ district: 1, acceptArea: 1, status: 1 });
demandSchema.index({ acceptArea: 1, status: 1 });
demandSchema.index({ assignedDesignUnit: 1, status: 1 });
demandSchema.index({ assignedConstructionUnit: 1, status: 1 });
demandSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model('Demand', demandSchema);
