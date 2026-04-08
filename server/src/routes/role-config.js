const express = require('express');
const RoleConfig = require('../models/role-config.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

const VALID_SCOPES = ['all', 'area', 'grid', 'self', 'assigned'];

/**
 * GET /api/admin/role-config
 * 获取所有角色配置
 */
router.get('/admin/role-config', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const list = await RoleConfig.find({}).sort({ role: 1 }).lean();
    res.json({ code: 0, data: { list } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/role-config/save
 * 修改角色可见范围（仅允许修改 visibilityScope 和 description）
 */
router.post('/admin/role-config/save', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { role, visibilityScope, description } = req.body;
    if (!role) throw createError(400, '角色代码不能为空');
    if (!VALID_SCOPES.includes(visibilityScope)) {
      throw createError(400, `visibilityScope 必须为: ${VALID_SCOPES.join(', ')}`);
    }

    const config = await RoleConfig.findOneAndUpdate(
      { role },
      { $set: { visibilityScope, ...(description !== undefined ? { description } : {}) } },
      { new: true }
    );
    if (!config) throw createError(404, `角色 ${role} 不存在`);

    logger.info('角色配置修改', { role, visibilityScope, operatorId: req.user._id });
    res.json({ code: 0, data: { role: config.role, visibilityScope: config.visibilityScope } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
