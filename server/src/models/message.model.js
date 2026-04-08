const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // 接收人
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  // 关联需求（可选）
  demandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Demand' },
  demandNo: { type: String },
  // 关联公告（可选，公告推送时使用）
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement' },
  // 消息类型
  type: {
    type: String,
    enum: ['assign', 'timeout', 'status_change', 'reject', 'remind', 'system', 'TIMEOUT_ALERT'],
    default: 'system'
  },
  read: { type: Boolean, default: false },
  readAt: { type: Date }
}, {
  timestamps: true
});

messageSchema.index({ recipientId: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
