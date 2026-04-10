const express = require('express');
const path = require('path');
const fs = require('fs');
const User = require('../models/user.model');
const Demand = require('../models/demand.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { fmtDate, fmtDuration } = require('../utils/format');
const { getDistrictFilter, getDistrictFromBody } = require('../utils/district');
const { getAssignedOrProcessedDemandFilter } = require('../utils/pc-access');
const { buildNetworkManagerDemandFilter, mergeFilter } = require('../utils/network-manager-scope');

const router = express.Router();

/**
 * 杞箟姝ｅ垯鐗规畩瀛楃锛岄槻姝?ReDoS
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 瑙ｆ瀽骞剁害鏉熷垎椤靛弬鏁?
 */
function parsePagination(page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  return { page: p, pageSize: ps };
}

const VALID_ROLES = ['FRONTLINE', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR', 'ADMIN', 'GRID_MANAGER', 'NETWORK_MANAGER'];
const STAFF_VIEW_ROLES = ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'];
const STAFF_MANAGE_ROLES = ['ADMIN', 'DISTRICT_MANAGER'];
const DISTRICT_ASSIGNABLE_ROLES = VALID_ROLES.filter((role) => role !== 'ADMIN');

const roleCodeToName = {
  FRONTLINE: '一线人员',
  DISTRICT_MANAGER: '区县管理员',
  DEPT_MANAGER: '部门经理',
  LEVEL4_MANAGER: '四级经理',
  GRID_MANAGER: '网格经理',
  NETWORK_MANAGER: '网络支撑经理',
  DESIGN: '设计',
  CONSTRUCTION: '施工',
  SUPERVISOR: '监理',
  ADMIN: '管理员'
};

function isAdminUser(req) {
  return (req.user?.roles || []).includes('ADMIN');
}

function assertSameDistrict(req, district) {
  if (isAdminUser(req)) return;
  if ((req.user?.district || '射洪市') !== (district || '射洪市')) {
    throw createError(403, '仅可操作本区县数据');
  }
}

async function getScopedUserOrThrow(req, userId) {
  const user = await User.findById(userId);
  if (!user) throw createError(404, '用户不存在');
  assertSameDistrict(req, user.district);
  if (!isAdminUser(req) && (user.roles || []).includes('ADMIN')) {
    throw createError(403, '鏃犳潈闄愭搷浣滅鐞嗗憳璐﹀彿');
  }
  return user;
}

/**
 * GET /api/admin/staff
 * 鑾峰彇浜哄憳閰嶇疆鍒楄〃
 */
router.get('/admin/staff', requireRole(...STAFF_VIEW_ROLES), async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, role, keyword } = req.query;
    const { page: p, pageSize: ps } = parsePagination(page, pageSize);
    const skip = (p - 1) * ps;

    const query = {};
    if (role) query.roles = role;
    if (keyword) {
      const safeKeyword = escapeRegex(keyword);
      query.$or = [
        { name: { $regex: safeKeyword, $options: 'i' } },
        { phone: { $regex: safeKeyword } }
      ];
    }
    // 鍖哄幙杩囨护
    Object.assign(query, getDistrictFilter(req));

    const [total, list] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(ps)
        .select('-openid -__v')
        .lean()
    ]);

    // 鎶?_id 鏄犲皠涓?id锛屾柟渚垮墠绔洿鎺ヤ娇鐢?
    const result = list.map(u => ({ ...u, id: String(u._id), _id: undefined }));

    res.json({ code: 0, data: { total, list: result } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/staff/save
 * 鏂板鎴栨洿鏂颁汉鍛橈紙鎸塸hone鍞竴锛?
 */
router.post('/admin/staff/save', requireRole(...STAFF_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { userId, name, phone, roles, area, gridName, feishuId, wxAccount, employeeId, staffType, active } = req.body;

    if (!name || !phone) throw createError(400, '姓名和手机号为必填项');
    if (!/^1[3-9]\d{9}$/.test(phone)) throw createError(400, '手机号格式不正确');
    if (!roles || !roles.length) throw createError(400, '至少选择一个角色');
    const invalidRoles = roles.filter(r => !VALID_ROLES.includes(r));
    if (invalidRoles.length) throw createError(400, `存在无效角色: ${invalidRoles.join(', ')}`);
    if (!isAdminUser(req)) {
      const forbiddenRoles = roles.filter((role) => !DISTRICT_ASSIGNABLE_ROLES.includes(role));
      if (forbiddenRoles.length) throw createError(403, `区县管理员不可分配这些角色: ${forbiddenRoles.join(', ')}`);
    }

    let user;
    if (userId) {
      user = await getScopedUserOrThrow(req, userId);
      const existing = await User.findOne({ phone, _id: { $ne: userId } });
      if (existing) throw createError(409, '璇ユ墜鏈哄彿宸茶鍏朵粬璐﹀彿浣跨敤');
    } else {
      const existing = await User.findOne({ phone });
      if (existing) throw createError(409, '该手机号已存在');
      user = new User();
    }

    user.name = name;
    user.phone = phone;
    user.roles = roles;
    user.area = area || '';
    user.gridName = gridName || '';
    user.feishuId = feishuId || '';
    user.wxAccount = wxAccount || '';
    user.employeeId = employeeId || '';
    user.staffType = staffType || '';
    user.district = getDistrictFromBody(req);
    if (typeof active === 'boolean') user.active = active;

    await user.save();
    logger.info('浜哄憳閰嶇疆淇濆瓨', { userId: user._id, operatorId: req.user._id });
    res.json({ code: 0, data: { userId: user._id } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/staff/:id
 * 鍒犻櫎浜哄憳
 */
router.delete('/admin/staff/:id', requireRole(...STAFF_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === String(req.user._id)) {
      throw createError(400, '不能删除自己的账号');
    }

    // 妫€鏌ユ槸鍚︽湁杩涜涓殑宸ュ崟鎸囨淳锛岄伩鍏嶅嚭鐜版偓绌哄紩鐢?
    const activeDemandCount = await Demand.countDocuments({
      status: { $nin: ['已开通', '已驳回'] },
      $or: [
        { assignedDesignUnit: id },
        { assignedConstructionUnit: id },
        { assignedSupervisor: id }
      ]
    });
    if (activeDemandCount > 0) {
      throw createError(400, `璇ヤ汉鍛樻湁 ${activeDemandCount} 涓繘琛屼腑鐨勫伐鍗曟寚娲撅紝璇峰厛閲嶆柊鎸囨淳鍚庡啀鍒犻櫎`);
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) throw createError(404, '用户不存在');

    logger.info('浜哄憳鍒犻櫎', { userId: id, operatorId: req.user._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/staff/toggle
 * 鍚敤/绂佺敤璐﹀彿
 */
router.post('/admin/staff/toggle', requireRole(...STAFF_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { userId, active } = req.body;
    if (!userId) throw createError(400, '缺少userId');
    if (String(userId) === String(req.user._id)) {
      throw createError(400, '不能禁用自己的账号');
    }

    const user = await User.findByIdAndUpdate(userId, { active }, { new: true });
    if (!user) throw createError(404, '用户不存在');

    logger.info('账号状态变更', { userId, active, operatorId: req.user._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/overview
 * 绠＄悊鍛樻€昏缁熻
 */
router.get('/admin/overview', requireRole('ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'), async (req, res, next) => {
  try {
    const districtFilter = getDistrictFilter(req);
    let baseFilter = { ...districtFilter };
    const isNetworkManager = (req.user.roles || []).includes('NETWORK_MANAGER');
    if (isNetworkManager) {
      baseFilter = mergeFilter(baseFilter, await buildNetworkManagerDemandFilter(req.user));
    }

    const pendingStatus = isNetworkManager ? '待确认' : '待审核';
    const inProgressExcludedStatuses = ['已开通', '已驳回', pendingStatus];
    const designTimeoutCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const constructionTimeoutCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

    const [total, pending, designCount, constructionCount, inProgress, completed, timeout, userCount] = await Promise.all([
      Demand.countDocuments(baseFilter),
      Demand.countDocuments(mergeFilter(baseFilter, { status: pendingStatus })),
      Demand.countDocuments(mergeFilter(baseFilter, { status: '设计中' })),
      Demand.countDocuments(mergeFilter(baseFilter, { status: { $in: ['施工中', '待确认'] } })),
      Demand.countDocuments(mergeFilter(baseFilter, { status: { $nin: inProgressExcludedStatuses } })),
      Demand.countDocuments(mergeFilter(baseFilter, { status: '已开通' })),
      Demand.countDocuments(mergeFilter(baseFilter, {
        $or: [
          { status: '设计中', designAssignTime: { $lte: designTimeoutCutoff } },
          { status: '施工中', constructionAssignTime: { $lte: constructionTimeoutCutoff } }
        ]
      })),
      User.countDocuments({ ...districtFilter, active: true })
    ]);

    res.json({ code: 0, data: { total, pending, designCount, constructionCount, inProgress, completed, timeout, userCount } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/staff/distinct
 * 杩斿洖宸茬櫥璁扮殑鍗曚綅(area)鍜岄儴闂?缃戞牸(gridName)鍘婚噸鍒楄〃锛岀敤浜庡墠绔笅鎷?
 */
router.get('/admin/staff/distinct', requireRole(...STAFF_VIEW_ROLES), async (req, res, next) => {
  try {
    const districtFilter = getDistrictFilter(req);
    const [areas, gridNames] = await Promise.all([
      User.distinct('area', { ...districtFilter, area: { $nin: [null, ''] } }),
      User.distinct('gridName', { ...districtFilter, gridName: { $nin: [null, ''] } })
    ]);
    res.json({
      code: 0,
      data: {
        areas: areas.filter(Boolean).sort(),
        gridNames: gridNames.filter(Boolean).sort()
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/staff/export
 * 瀵煎嚭浜哄憳閰嶇疆锛圕SV鏍煎紡锛?
 */
router.get('/admin/staff/export', requireRole(...STAFF_VIEW_ROLES), async (req, res, next) => {
  try {
    const users = await User.find(getDistrictFilter(req)).sort({ createdAt: -1 }).lean();

    // CSV 琛ㄥご
    const headers = ['姓名', '手机号', '微信号', '飞书账号', '单位', '部门/网格', '工号', '人员属性', '角色', '状态'];

    // CSV 鏁版嵁琛?
    const rows = users.map(u => [
      u.name || '',
      u.phone || '',
      u.wxAccount || '',
      u.feishuId || '',
      u.area || '',
      u.gridName || '',
      u.employeeId || '',
      u.staffType || '',
      (u.roles || []).map(r => roleCodeToName[r] || r).join('/'),
      u.active ? '鍚敤' : '绂佺敤'
    ]);

    // 杞箟CSV瀛楁锛堝鐞嗛€楀彿銆佸紩鍙风瓑锛?
    const escapeCSV = (str) => {
      if (str == null) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    // 璁剧疆鍝嶅簲澶?
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=staff_config_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.csv`);

    // 娣诲姞 BOM 浠ユ敮鎸?Excel 鎵撳紑 UTF-8 缂栫爜鐨?CSV
    res.send('\ufeff' + csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/staff/import
 * 瀵煎叆浜哄憳閰嶇疆锛圕SV鏍煎紡锛?
 * 浠ュ鍚嶄负绱㈠紩锛?
 * 1. 鑻ュ師绯荤粺宸叉湁鐩稿悓濮撳悕锛?
 *    - 鍘熷瓧娈典负绌猴紝鐜板瓧娈典笉涓虹┖ 鈫?浠ュ鍏ユ暟鎹负鍑嗕慨鏀?
 *    - 鍘熷瓧娈典笉涓虹┖锛岀幇瀛楁涓虹┖ 鈫?淇濈暀鍘熷瓧娈?
 * 2. 鑻ュ師绯荤粺娌℃湁璇ュ鍚?鈫?鏂板璇ヤ汉鍛?
 */
router.post('/admin/staff/import', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      throw createError(400, '导入数据格式错误，请检查文件内容');
    }

    const results = {
      success: 0,
      updated: 0,
      added: 0,
      skipped: 0,
      errors: []
    };

    const roleNameToCode = {
      '一线人员': 'FRONTLINE',
      '区县管理员': 'DISTRICT_MANAGER',
      '部门经理': 'DEPT_MANAGER',
      '四级经理': 'LEVEL4_MANAGER',
      '网格经理': 'GRID_MANAGER',
      '网络支撑经理': 'NETWORK_MANAGER',
      '设计': 'DESIGN',
      '施工': 'CONSTRUCTION',
      '监理': 'SUPERVISOR',
      '管理员': 'ADMIN'
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i] || {};
      const rowNum = i + 2;

      try {
        const name = String(row['姓名'] || '').trim();
        if (!name) {
          results.errors.push(`第${rowNum}行：姓名为空，已跳过`);
          results.skipped++;
          continue;
        }

        const phone = String(row['手机号'] || '').trim();
        const wxAccount = String(row['微信号'] || '').trim();
        const feishuId = String(row['飞书账号'] || '').trim();
        const area = String(row['单位'] || '').trim();
        const gridName = String(row['部门/网格'] || '').trim();
        const employeeId = String(row['工号'] || '').trim();
        const staffType = String(row['人员属性'] || '').trim();
        const rolesStr = String(row['角色'] || '').trim();
        const statusStr = String(row['状态'] || '').trim();

        const roles = rolesStr
          ? rolesStr.split('/').map((item) => roleNameToCode[item.trim()] || item.trim()).filter((role) => VALID_ROLES.includes(role))
          : [];

        let user = phone
          ? await User.findOne({ phone })
          : await User.findOne({ name: { $regex: new RegExp('^' + escapeRegex(name) + '$', 'i') } });

        if (user) {
          assertSameDistrict(req, user.district);

          if (phone && phone !== user.phone) {
            const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } });
            if (!phoneExists) user.phone = phone;
          }
          if (wxAccount) user.wxAccount = wxAccount;
          if (feishuId) user.feishuId = feishuId;
          if (area) user.area = area;
          if (gridName) user.gridName = gridName;
          if (employeeId) user.employeeId = employeeId;
          if (staffType) user.staffType = staffType;
          if (roles.length) user.roles = roles;
          if (statusStr === '禁用') user.active = false;
          else if (statusStr === '启用') user.active = true;

          await user.save();
          results.updated++;
          results.success++;
        } else {
          logger.info(`导入未匹配到用户: ${name}，将新增`);
          if (!phone) {
            results.errors.push(`第${rowNum}行：新增用户手机号不能为空，已跳过`);
            results.skipped++;
            continue;
          }

          const phoneExists = await User.findOne({ phone });
          if (phoneExists) {
            results.errors.push(`第${rowNum}行：手机号 ${phone} 已被其他用户占用，已跳过`);
            results.skipped++;
            continue;
          }

          user = new User({
            name,
            phone,
            wxAccount: wxAccount || '',
            feishuId: feishuId || '',
            area: area || '',
            gridName: gridName || '',
            employeeId: employeeId || '',
            staffType: staffType || '',
            roles: roles.length ? roles : ['FRONTLINE'],
            active: statusStr !== '禁用',
            district: getDistrictFromBody(req, row)
          });

          await user.save();
          logger.info(`新用户 ${name} 已创建`);
          results.added++;
          results.success++;
        }
      } catch (rowErr) {
        results.errors.push(`第${rowNum}行：${rowErr.message}`);
        results.skipped++;
      }
    }

    logger.info('人员配置导入', { operatorId: req.user._id, results });
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
 * GET /api/admin/demands/export
 * 导出工单列表为 xlsx
 */
router.get('/admin/demands/export', requireRole('ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR'), async (req, res, next) => {
  try {
    const { keyword, status, type, area, dateFrom, dateTo } = req.query;
    let query = { ...getDistrictFilter(req) };
    const roles = req.user.roles || [];

    if (roles.includes('NETWORK_MANAGER')) {
      query = mergeFilter(query, await buildNetworkManagerDemandFilter(req.user));
    } else if (roles.includes('DESIGN') || roles.includes('CONSTRUCTION') || roles.includes('SUPERVISOR')) {
      query = mergeFilter(query, getAssignedOrProcessedDemandFilter(req.user));
    }

    if (status) query.status = status;
    if (type) query.type = type;
    if (area && !roles.includes('NETWORK_MANAGER')) {
      query.acceptArea = { $regex: escapeRegex(area), $options: 'i' };
    }
    if (keyword) {
      const safeKw = escapeRegex(keyword);
      query = mergeFilter(query, {
        $or: [
          { demandNo: { $regex: safeKw, $options: 'i' } },
          { demandPersonName: { $regex: safeKw, $options: 'i' } },
          { locationDetail: { $regex: safeKw, $options: 'i' } }
        ]
      });
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const demands = await Demand.find(query)
      .populate('createdBy', 'name')
      .populate('assignedDesignUnit', 'name')
      .populate('assignedConstructionUnit', 'name')
      .populate('assignedSupervisor', 'name')
      .populate('confirmBy', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const serverBaseUrl = process.env.SERVER_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const toAbsUrl = (url) => {
      if (!url) return '';
      return url.startsWith('http') ? url : serverBaseUrl + url;
    };
    const fmtUrls = (arr) => (arr || []).map(toAbsUrl).filter(Boolean).join('\n');

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '射洪建设支撑系统';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('工单列表', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    ws.columns = [
      { header: '工单编号', key: 'demandNo', width: 20 },
      { header: '所属区县', key: 'district', width: 12 },
      { header: '受理区域', key: 'acceptArea', width: 18 },
      { header: '网格', key: 'gridName', width: 16 },
      { header: '服务中心', key: 'serviceCenter', width: 18 },
      { header: '网络支撑中心', key: 'networkSupport', width: 18 },
      { header: '申请人姓名', key: 'demandPersonName', width: 12 },
      { header: '申请人电话', key: 'demandPersonPhone', width: 14 },
      { header: '提交人', key: 'createdByName', width: 12 },
      { header: '业务类型', key: 'businessType', width: 10 },
      { header: '需求类型', key: 'type', width: 10 },
      { header: '预约客户数', key: 'reservedCustomers', width: 12 },
      { header: 'DP箱数量', key: 'dpBoxCount', width: 10 },
      { header: '紧急程度', key: 'urgency', width: 10 },
      { header: '详细地址', key: 'locationDetail', width: 30 },
      { header: '现场照片', key: 'photos', width: 50 },
      { header: '设计单位', key: 'designUnit', width: 14 },
      { header: '是否有资源', key: 'hasResource', width: 12 },
      { header: '资源名称', key: 'resourceName', width: 16 },
      { header: '现有资源照片', key: 'resourcePhotos', width: 50 },
      { header: '设计文件', key: 'designFiles', width: 50 },
      { header: '设计备注', key: 'designRemark', width: 20 },
      { header: '施工单位', key: 'constructionUnit', width: 14 },
      { header: '覆盖点名称', key: 'coverageName', width: 16 },
      { header: '资产状态', key: 'assetStatus', width: 12 },
      { header: '完工位置详细描述', key: 'constructionLocationDetail', width: 24 },
      { header: '施工照片', key: 'constructionPhotos', width: 50 },
      { header: '施工备注', key: 'constructionRemark', width: 20 },
      { header: '监理单位', key: 'supervisorUnit', width: 14 },
      { header: '监理备注', key: 'supervisorRemark', width: 20 },
      { header: '监理验收时间', key: 'supervisorVerifyTime', width: 18 },
      { header: '监理验收照片', key: 'supervisorPhotos', width: 50 },
      { header: '确认人', key: 'confirmByName', width: 12 },
      { header: '确认时间', key: 'confirmTime', width: 18 },
      { header: '创建时间', key: 'createdAt', width: 18 },
      { header: '设计指派时间', key: 'designAssignTime', width: 18 },
      { header: '施工指派时间', key: 'constructionAssignTime', width: 18 },
      { header: '完成时间', key: 'completedTime', width: 18 },
      { header: '总耗时', key: 'totalDuration', width: 12 },
      { header: '设计耗时', key: 'designDuration', width: 12 },
      { header: '施工耗时', key: 'constructionDuration', width: 12 },
      { header: '最终状态', key: 'status', width: 12 },
      { header: '驳回次数', key: 'rejectCount', width: 10 },
      { header: '驳回原因', key: 'rejectionReason', width: 24 }
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 28;

    const fileColumnKeys = new Set(['photos', 'resourcePhotos', 'designFiles', 'constructionPhotos', 'supervisorPhotos']);

    demands.forEach((d) => {
      const row = ws.addRow({
        demandNo: d.demandNo || '',
        district: d.district || '',
        acceptArea: d.acceptArea || '',
        gridName: d.gridName || '',
        serviceCenter: d.serviceCenter || '',
        networkSupport: d.networkSupport || '',
        demandPersonName: d.demandPersonName || '',
        demandPersonPhone: d.demandPersonPhone || '',
        createdByName: d.createdBy?.name || '',
        businessType: d.businessType || '',
        type: d.type || '',
        reservedCustomers: d.reservedCustomers ?? '',
        dpBoxCount: d.dpBoxCount ?? '',
        urgency: d.urgency || '',
        locationDetail: d.locationDetail || '',
        photos: fmtUrls(d.photos),
        designUnit: d.assignedDesignUnit?.name || '',
        hasResource: d.hasResource == null ? '' : (d.hasResource ? '是（300m内）' : '否'),
        resourceName: d.resourceName || '',
        resourcePhotos: fmtUrls(d.resourcePhotos),
        designFiles: fmtUrls(d.designFiles),
        designRemark: d.designRemark || '',
        constructionUnit: d.assignedConstructionUnit?.name || '',
        coverageName: d.coverageName || '',
        assetStatus: d.assetStatus || '',
        constructionLocationDetail: d.constructionLocationDetail || '',
        constructionPhotos: fmtUrls(d.constructionPhotos),
        constructionRemark: d.constructionRemark || '',
        supervisorUnit: d.assignedSupervisor?.name || '',
        supervisorRemark: d.supervisorRemark || '',
        supervisorVerifyTime: fmtDate(d.supervisorVerifyTime),
        supervisorPhotos: fmtUrls(d.supervisorPhotos),
        confirmByName: d.confirmBy?.name || '',
        confirmTime: fmtDate(d.confirmTime),
        createdAt: fmtDate(d.createdAt),
        designAssignTime: fmtDate(d.designAssignTime),
        constructionAssignTime: fmtDate(d.constructionAssignTime),
        completedTime: fmtDate(d.completedTime),
        totalDuration: fmtDuration(d.totalDuration),
        designDuration: fmtDuration(d.designDuration),
        constructionDuration: fmtDuration(d.constructionDuration),
        status: d.status || '',
        rejectCount: d.rejectCount ?? 0,
        rejectionReason: d.rejectionReason || ''
      });

      ws.columns.forEach((col, colIdx) => {
        if (!fileColumnKeys.has(col.key)) return;
        const cell = row.getCell(colIdx + 1);
        const cellText = cell.value;
        if (!cellText) return;

        const urls = String(cellText).split('\n').filter(Boolean);
        cell.alignment = { wrapText: true, vertical: 'top' };

        if (urls.length === 1) {
          const url = urls[0];
          const fileName = url.split('/').pop() || url;
          cell.value = { text: fileName, hyperlink: url, tooltip: url };
          cell.font = { color: { argb: 'FF1890FF' }, underline: true };
        } else {
          cell.font = { color: { argb: 'FF1890FF' } };
        }
      });

      row.alignment = { vertical: 'top', wrapText: false };
      row.height = 20;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="demands_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
