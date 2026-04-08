const express = require('express');
const Message = require('../models/message.model');
const { createError } = require('../middleware/error-handler');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/message/list
 * 获取当前用户消息列表
 */
router.get('/message/list', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, unreadOnly = false } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const query = { recipientId: req.user._id };
    if (unreadOnly === 'true') query.read = false;

    const [total, unreadCount, list] = await Promise.all([
      Message.countDocuments(query),
      Message.countDocuments({ recipientId: req.user._id, read: false }),
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(pageSize))
        .select('title content type demandId demandNo announcementId read readAt createdAt')
    ]);

    res.json({ code: 0, data: { total, unreadCount, list } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/message/read
 * 标记消息已读
 */
router.post('/message/read', async (req, res, next) => {
  try {
    const { messageId, readAll } = req.body;

    if (readAll) {
      // 标记所有未读消息为已读
      await Message.updateMany(
        { recipientId: req.user._id, read: false },
        { $set: { read: true, readAt: new Date() } }
      );
      res.json({ code: 0, data: {} });
      return;
    }

    if (!messageId) throw createError(400, '缺少消息ID');

    const msg = await Message.findOne({ _id: messageId, recipientId: req.user._id });
    if (!msg) throw createError(404, '消息不存在');
    if (msg.read) {
      res.json({ code: 0, data: {} });
      return;
    }

    msg.read = true;
    msg.readAt = new Date();
    await msg.save();

    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
