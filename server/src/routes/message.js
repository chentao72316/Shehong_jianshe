const express = require('express');
const Message = require('../models/message.model');
const { createError } = require('../middleware/error-handler');

const router = express.Router();

router.get('/message/list', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, unreadOnly = false } = req.query;
    const skip = (Number(page) - 1) * Number(pageSize);

    const query = { recipientId: req.user._id, archived: { $ne: true } };
    if (unreadOnly === 'true') query.read = false;

    const [total, unreadCount, list] = await Promise.all([
      Message.countDocuments(query),
      Message.countDocuments({ recipientId: req.user._id, archived: { $ne: true }, read: false }),
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(pageSize))
        .lean()
        .select('title content type demandId demandNo announcementId read readAt createdAt')
    ]);

    const normalizedList = list.map(item => ({
      id: String(item._id),
      title: item.title,
      content: item.content,
      type: item.type,
      demandId: item.demandId ? String(item.demandId) : '',
      demandNo: item.demandNo || '',
      announcementId: item.announcementId ? String(item.announcementId) : '',
      read: item.read,
      readAt: item.readAt,
      createdAt: item.createdAt
    }));

    res.json({ code: 0, data: { total, unreadCount, list: normalizedList } });
  } catch (err) {
    next(err);
  }
});

router.post('/message/read', async (req, res, next) => {
  try {
    const { messageId, readAll } = req.body;

    if (readAll) {
      await Message.updateMany(
        { recipientId: req.user._id, archived: { $ne: true }, read: false },
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

router.post('/message/archive', async (req, res, next) => {
  try {
    const { messageId } = req.body;
    if (!messageId) throw createError(400, '缺少消息ID');

    const msg = await Message.findOne({ _id: messageId, recipientId: req.user._id });
    if (!msg) throw createError(404, '消息不存在');

    if (msg.archived) {
      res.json({ code: 0, data: {} });
      return;
    }

    const now = new Date();
    msg.archived = true;
    msg.archivedAt = now;
    if (!msg.read) {
      msg.read = true;
      msg.readAt = now;
    }
    await msg.save();

    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

router.post('/message/archive-all', async (req, res, next) => {
  try {
    const now = new Date();

    await Message.updateMany(
      {
        recipientId: req.user._id,
        archived: { $ne: true },
        type: { $ne: 'system' }
      },
      {
        $set: {
          archived: true,
          archivedAt: now,
          read: true,
          readAt: now
        }
      }
    );

    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
