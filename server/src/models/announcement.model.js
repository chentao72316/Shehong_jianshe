const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null }, // null 表示永久有效
  active: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, {
  timestamps: true
});

announcementSchema.index({ active: 1, startTime: 1, endTime: 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
