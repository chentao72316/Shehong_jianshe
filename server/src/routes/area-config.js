const express = require('express');
const AreaConfig = require('../models/area-config.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { getDistrictFilter, getDistrictFromBody } = require('../utils/district');

const router = express.Router();

/**
 * GET /api/admin/area-config
 * 获取所有受理区域配置（含候选人员信息）
 * ADMIN 可通过 ?district=xxx 筛选区县；非 ADMIN 只能看本区县
 */
router.get('/admin/area-config', requireRole('ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'), async (req, res, next) => {
  try {
    const filter = getDistrictFilter(req);
    const list = await AreaConfig.find(filter)
      .sort({ district: 1, acceptArea: 1 })
      .populate('designCandidates', 'name phone')
      .populate('constructionCandidates', 'name phone')
      .populate('supervisorCandidates', 'name phone')
      .populate('networkManagerId', 'name phone')
      .lean();
    res.json({ code: 0, data: { list } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/area-config/by-area/:area
 * 查询单个受理区域配置（创建工单时用，不要求ADMIN权限）
 * ?district=xxx 指定区县（不传默认射洪市）
 */
router.get('/admin/area-config/by-area/:area', async (req, res, next) => {
  try {
    const { area } = req.params;
    const district = req.query.district || req.user?.district || '射洪市';
    const config = await AreaConfig.findOne({ district, acceptArea: area, active: true })
      .populate('designCandidates', 'name phone active')
      .populate('constructionCandidates', 'name phone active')
      .populate('supervisorCandidates', 'name phone active')
      .populate('networkManagerId', 'name phone')
      .lean();
    res.json({ code: 0, data: config || null });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/area-config/save
 * 新增或更新受理区域配置（按 district + acceptArea upsert）
 */
router.post('/admin/area-config/save', requireRole('ADMIN', 'DISTRICT_MANAGER'), async (req, res, next) => {
  try {
    const {
      acceptArea, networkCenter,
      designCandidates, constructionCandidates, supervisorCandidates,
      networkManagerId, active
    } = req.body;

    if (!acceptArea || !acceptArea.trim()) throw createError(400, '受理区域名称不能为空');

    const district = getDistrictFromBody(req);

    const update = {
      district,
      networkCenter: networkCenter || '',
      designCandidates: designCandidates || [],
      constructionCandidates: constructionCandidates || [],
      supervisorCandidates: supervisorCandidates || [],
      networkManagerId: networkManagerId || null,
      active: active !== false
    };

    const config = await AreaConfig.findOneAndUpdate(
      { district, acceptArea: acceptArea.trim() },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );

    logger.info('区域配置保存', { district, acceptArea, operatorId: req.user._id });
    res.json({ code: 0, data: { id: String(config._id) } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/area-config/:id
 * 删除受理区域配置
 */
router.delete('/admin/area-config/:id', requireRole('ADMIN', 'DISTRICT_MANAGER'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const config = await AreaConfig.findById(id);
    if (!config) throw createError(404, '配置不存在');
    if (!(req.user.roles || []).includes('ADMIN') && (config.district || '射洪市') !== (req.user.district || '射洪市')) {
      throw createError(403, '仅可删除本区县配置');
    }
    await AreaConfig.findByIdAndDelete(id);
    logger.info('区域配置删除', { id, acceptArea: config.acceptArea, district: config.district, operatorId: req.user._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
