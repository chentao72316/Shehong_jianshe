const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  demandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Demand' },
  demandNo: { type: String },
  announcementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Announcement' },
  type: {
    type: String,
    enum: ['assign', 'timeout', 'status_change', 'reject', 'remind', 'system', 'TIMEOUT_ALERT'],
    default: 'system'
  },
  read: { type: Boolean, default: false },
  readAt: { type: Date },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date }
}, {
  timestamps: true
});

messageSchema.index({ recipientId: 1, archived: 1, createdAt: -1 });
messageSchema.index({ recipientId: 1, archived: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
