const express = require('express');
const AreaConfig = require('../models/area-config.model');
const User = require('../models/user.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { DISTRICTS, getDistrictFilter, getDistrictFromBody } = require('../utils/district');

const router = express.Router();

function isAdminUser(req) {
  return (req.user?.roles || []).includes('ADMIN');
}

function escapeCSV(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function formatUsers(users = []) {
  return users
    .filter(Boolean)
    .map((user) => `${user.name || ''}${user.phone ? `(${user.phone})` : ''}`)
    .filter(Boolean)
    .join('/');
}

function parseUserTokens(value) {
  return String(value || '')
    .split(/[、/，,\s]+/)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function buildUserLookupQuery(token, role, district) {
  const phoneMatch = token.match(/1[3-9]\d{9}/);
  const identityFilter = phoneMatch ? { phone: phoneMatch[0] } : { name: token.replace(/[()（）]/g, '').trim() };
  const districtFilter = role === 'NETWORK_MANAGER'
    ? { district }
    : { $or: [{ district }, { serviceDistricts: district }] };
  return { ...identityFilter, roles: role, active: { $ne: false }, ...districtFilter };
}

async function resolveUsers(value, role, district, missingItems = [], label = '候选人') {
  const users = [];
  for (const token of parseUserTokens(value)) {
    const user = await User.findOne(buildUserLookupQuery(token, role, district)).select('_id name phone').lean();
    if (user) users.push(String(user._id));
    else missingItems.push(`${label}:${token}`);
  }
  return [...new Set(users)];
}

async function resolveSingleUser(value, role, district, missingItems = [], label = '候选人') {
  const ids = await resolveUsers(value, role, district, missingItems, label);
  return ids[0] || null;
}

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
 * GET /api/admin/area-config/export
 * 导出区域配置 CSV。
 */
router.get('/admin/area-config/export', requireRole('ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'), async (req, res, next) => {
  try {
    const list = await AreaConfig.find(getDistrictFilter(req))
      .sort({ district: 1, acceptArea: 1 })
      .populate('designCandidates', 'name phone')
      .populate('constructionCandidates', 'name phone')
      .populate('supervisorCandidates', 'name phone')
      .populate('networkManagerId', 'name phone')
      .lean();

    const headers = ['区县', '受理区域', '网络支撑中心', '设计候选人', '施工候选人', '监理候选人', '确认经理', '状态'];
    const rows = list.map((item) => [
      item.district || '',
      item.acceptArea || '',
      item.networkCenter || '',
      formatUsers(item.designCandidates),
      formatUsers(item.constructionCandidates),
      formatUsers(item.supervisorCandidates),
      formatUsers(item.networkManagerId ? [item.networkManagerId] : []),
      item.active === false ? '禁用' : '启用'
    ]);

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map((row) => row.map(escapeCSV).join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=area_config_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`);
    res.send('\ufeff' + csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/area-config/import
 * 导入区域配置 CSV 解析后的数据。按 district + acceptArea 追加/更新，不删除其他配置。
 */
router.post('/admin/area-config/import', requireRole('ADMIN', 'DISTRICT_MANAGER'), async (req, res, next) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) throw createError(400, '导入数据格式错误，请检查文件内容');

    const results = { success: 0, updated: 0, added: 0, skipped: 0, errors: [] };
    for (let i = 0; i < data.length; i++) {
      const row = data[i] || {};
      const rowNum = i + 2;
      try {
        const rawDistrict = String(row['区县'] || '').trim();
        const district = getDistrictFromBody(req, { district: DISTRICTS.includes(rawDistrict) ? rawDistrict : undefined });
        if (!DISTRICTS.includes(district)) throw createError(400, '区县不在可选范围内');
        if (!isAdminUser(req) && district !== (req.user?.district || '射洪市')) throw createError(403, '仅可导入本区县配置');

        const acceptArea = String(row['受理区域'] || '').trim();
        if (!acceptArea) {
          results.errors.push(`第${rowNum}行：受理区域为空，已跳过`);
          results.skipped++;
          continue;
        }

        const networkCenter = String(row['网络支撑中心'] || '').trim();
        const missingUsers = [];
        const designCandidates = await resolveUsers(row['设计候选人'], 'DESIGN', district, missingUsers, '设计候选人');
        const constructionCandidates = await resolveUsers(row['施工候选人'], 'CONSTRUCTION', district, missingUsers, '施工候选人');
        const supervisorCandidates = await resolveUsers(row['监理候选人'], 'SUPERVISOR', district, missingUsers, '监理候选人');
        const networkManagerId = await resolveSingleUser(row['确认经理'], 'NETWORK_MANAGER', district, missingUsers, '确认经理');
        const active = String(row['状态'] || '启用').trim() !== '禁用';

        const existing = await AreaConfig.findOne({ district, acceptArea });
        await AreaConfig.findOneAndUpdate(
          { district, acceptArea },
          {
            $set: {
              district,
              acceptArea,
              networkCenter,
              designCandidates,
              constructionCandidates,
              supervisorCandidates,
              networkManagerId,
              active
            }
          },
          { upsert: true, new: true, runValidators: true }
        );

        if (existing) results.updated++;
        else results.added++;
        results.success++;
        if (missingUsers.length) results.errors.push(`第${rowNum}行：未匹配人员 ${missingUsers.join('、')}`);
      } catch (rowErr) {
        results.errors.push(`第${rowNum}行：${rowErr.message}`);
        results.skipped++;
      }
    }

    logger.info('区域配置导入', { operatorId: req.user._id, results });
    res.json({
      code: 0,
      data: {
        message: `导入完成：新增 ${results.added} 条，更新 ${results.updated} 条，跳过 ${results.skipped} 条`,
        details: results
      }
    });
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
