const express = require('express');
const Config = require('../models/config.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();
const SENSITIVE_KEYS = new Set(['FASTGPT_API_KEY']);

/**
 * GET /api/config/list
 * 获取所有配置项列表（仅管理员）
 * 注意：此路由必须放在 /config/:key 前面，避免被 :key 匹配
 */
router.get('/config/list', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const configs = await Config.find().sort({ key: 1 }).lean();
    res.json({ code: 0, data: configs });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/config/batch
 * 批量导入配置（仅管理员）
 * 用于从处理组配置表等数据源批量导入
 */
router.post('/config/batch', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) {
      throw createError(400, 'items 必须是数组');
    }

    const results = { success: 0, errors: [] };
    for (const item of items) {
      try {
        const { key, value, label, description } = item;
        if (!key) {
          results.errors.push(`缺少key: ${JSON.stringify(item)}`);
          continue;
        }
        await Config.findOneAndUpdate(
          { key },
          {
            $set: {
              value,
              label,
              description,
              updatedAt: new Date()
            },
            $setOnInsert: { key }
          },
          { upsert: true, new: true }
        );
        results.success++;
      } catch (e) {
        results.errors.push(`处理失败 ${JSON.stringify(item)}: ${e.message}`);
      }
    }

    logger.info('配置批量导入', { count: results.success, operatorId: req.user._id });
    res.json({ code: 0, data: results });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/config/:key
 * 获取配置项
 */
router.get('/config/:key', async (req, res, next) => {
  try {
    const { key } = req.params;
    if (SENSITIVE_KEYS.has(key) && !(req.user.roles || []).includes('ADMIN')) {
      throw createError(403, '无权限读取该配置项');
    }
    const config = await Config.findOne({ key }).lean();
    if (!config) {
      return res.json({ code: 0, data: null });
    }
    res.json({ code: 0, data: config.value });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/config/:key
 * 更新或创建配置项（仅管理员）
 */
router.put('/config/:key', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value, label, description } = req.body;

    const config = await Config.findOneAndUpdate(
      { key },
      {
        $set: {
          value,
          label,
          description,
          updatedAt: new Date()
        },
        $setOnInsert: { key }
      },
      { upsert: true, new: true }
    );

    logger.info('配置更新', { key, operatorId: req.user._id });
    res.json({ code: 0, data: config });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/config/:key
 * 删除配置项（仅管理员）
 */
router.delete('/config/:key', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { key } = req.params;
    await Config.deleteOne({ key });
    logger.info('配置删除', { key, operatorId: req.user._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
