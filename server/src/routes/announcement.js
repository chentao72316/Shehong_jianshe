const express = require('express');
const Announcement = require('../models/announcement.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const { requireRole } = require('../middleware/auth');
const { createError } = require('../middleware/error-handler');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/announcement/detail/:id
 * 获取单条公告详情（小程序公告详情页使用）
 */
router.get('/announcement/detail/:id', async (req, res, next) => {
  try {
    const ann = await Announcement.findById(req.params.id).lean();
    if (!ann) throw createError(404, '公告不存在');
    res.json({ code: 0, data: ann });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/announcement/list
 * 获取当前有效的公告列表（小程序首页走马灯、消息列表使用）
 */
router.get('/announcement/list', async (req, res, next) => {
  try {
    const now = new Date();
    const announcements = await Announcement.find({
      active: true,
      startTime: { $lte: now },
      $or: [{ endTime: null }, { endTime: { $gte: now } }]
    }).sort({ createdAt: -1 }).limit(10).lean();

    res.json({ code: 0, data: announcements });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/announcement/admin/list
 * 管理端获取所有公告（分页）
 */
router.get('/announcement/admin/list', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(pageSize);
    const [list, total] = await Promise.all([
      Announcement.find()
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(pageSize))
        .lean(),
      Announcement.countDocuments()
    ]);
    res.json({ code: 0, data: { list, total } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/announcement/create
 * 创建公告，并向所有用户推送站内消息
 */
router.post('/announcement/create', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { title, content, startTime, endTime } = req.body;
    if (!title?.trim()) throw createError(400, '公告标题不能为空');
    if (!content?.trim()) throw createError(400, '公告内容不能为空');

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      startTime: startTime ? new Date(startTime) : new Date(),
      endTime: endTime ? new Date(endTime) : null,
      active: true,
      createdBy: req.user._id
    });

    // 向所有活跃用户推送 system 类型的站内消息
    const users = await User.find({ active: true }).select('_id').lean();
    if (users.length > 0) {
      const messages = users.map(u => ({
        recipientId: u._id,
        title: title.trim(),
        content: content.trim(),
        type: 'system',
        announcementId: announcement._id,
        read: false
      }));
      await Message.insertMany(messages, { ordered: false });
      logger.info('公告推送站内消息', { announcementId: announcement._id, userCount: users.length });
    }

    res.json({ code: 0, data: { id: announcement._id } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/announcement/toggle
 * 启用/停用公告
 */
router.post('/announcement/toggle', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id, active } = req.body;
    if (typeof active !== 'boolean') throw createError(400, 'active 必须为布尔值');

    const ann = await Announcement.findByIdAndUpdate(id, { active }, { new: true });
    if (!ann) throw createError(404, '公告不存在');

    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/announcement/:id
 * 删除公告
 */
router.delete('/announcement/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) throw createError(404, '公告不存在');
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
