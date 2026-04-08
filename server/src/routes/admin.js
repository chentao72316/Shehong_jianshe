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

const router = express.Router();

/**
 * 转义正则特殊字符，防止 ReDoS
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 解析并约束分页参数
 */
function parsePagination(page, pageSize) {
  const p = Math.max(1, Number(page) || 1);
  const ps = Math.min(Math.max(1, Number(pageSize) || 20), 100);
  return { page: p, pageSize: ps };
}

const VALID_ROLES = ['FRONTLINE', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'LEVEL4_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR', 'ADMIN', 'GRID_MANAGER', 'NETWORK_MANAGER'];

// 角色代码到中文名称映射
const roleCodeToName = {
  'FRONTLINE': '一线人员',
  'DISTRICT_MANAGER': '区县经理',
  'DEPT_MANAGER': '部门经理',
  'LEVEL4_MANAGER': '四级经理',
  'GRID_MANAGER': '网格经理',
  'NETWORK_MANAGER': '网络支撑经理',
  'DESIGN': '设计',
  'CONSTRUCTION': '施工',
  'SUPERVISOR': '监理',
  'ADMIN': '管理员'
};

/**
 * GET /api/admin/staff
 * 获取人员配置列表
 */
router.get('/admin/staff', requireRole('ADMIN'), async (req, res, next) => {
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
    // 区县过滤
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

    // 把 _id 映射为 id，方便前端直接使用
    const result = list.map(u => ({ ...u, id: String(u._id), _id: undefined }));

    res.json({ code: 0, data: { total, list: result } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/staff/save
 * 新增或更新人员（按phone唯一）
 */
router.post('/admin/staff/save', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { userId, name, phone, roles, area, gridName, feishuId, wxAccount, employeeId, staffType, active } = req.body;

    if (!name || !phone) throw createError(400, '姓名和手机号为必填项');
    if (!/^1[3-9]\d{9}$/.test(phone)) throw createError(400, '手机号格式不正确');
    if (!roles || !roles.length) throw createError(400, '至少选择一个角色');
    const invalidRoles = roles.filter(r => !VALID_ROLES.includes(r));
    if (invalidRoles.length) throw createError(400, `无效角色: ${invalidRoles.join(', ')}`);

    let user;
    if (userId) {
      user = await User.findById(userId);
      if (!user) throw createError(404, '用户不存在');
      // 检查手机号是否被其他人占用
      const existing = await User.findOne({ phone, _id: { $ne: userId } });
      if (existing) throw createError(409, '该手机号已被其他账号使用');
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
    logger.info('人员配置保存', { userId: user._id, operatorId: req.user._id });
    res.json({ code: 0, data: { userId: user._id } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/staff/:id
 * 删除人员
 */
router.delete('/admin/staff/:id', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === String(req.user._id)) {
      throw createError(400, '不能删除自己的账号');
    }

    // 检查是否有进行中的工单指派，避免出现悬空引用
    const activeDemandCount = await Demand.countDocuments({
      status: { $nin: ['已开通', '已驳回'] },
      $or: [
        { assignedDesignUnit: id },
        { assignedConstructionUnit: id },
        { assignedSupervisor: id }
      ]
    });
    if (activeDemandCount > 0) {
      throw createError(400, `该人员有 ${activeDemandCount} 个进行中的工单指派，请先重新指派后再删除`);
    }

    const user = await User.findByIdAndDelete(id);
    if (!user) throw createError(404, '用户不存在');

    logger.info('人员删除', { userId: id, operatorId: req.user._id });
    res.json({ code: 0, data: {} });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/staff/toggle
 * 启用/禁用账号
 */
router.post('/admin/staff/toggle', requireRole('ADMIN'), async (req, res, next) => {
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
 * 管理员总览统计
 */
router.get('/admin/overview', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const districtFilter = getDistrictFilter(req);
    const designTimeoutCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const constructionTimeoutCutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const [total, pending, inProgress, completed, timeout, userCount] = await Promise.all([
      Demand.countDocuments({ ...districtFilter }),
      Demand.countDocuments({ ...districtFilter, status: '待审核' }),
      Demand.countDocuments({ ...districtFilter, status: { $nin: ['已开通', '已驳回', '待审核'] } }),
      Demand.countDocuments({ ...districtFilter, status: '已开通' }),
      Demand.countDocuments({ ...districtFilter, $or: [
        { status: '设计中', designAssignTime: { $lte: designTimeoutCutoff } },
        { status: '施工中', constructionAssignTime: { $lte: constructionTimeoutCutoff } }
      ]}),
      User.countDocuments({ ...districtFilter, active: true })
    ]);

    res.json({ code: 0, data: { total, pending, inProgress, completed, timeout, userCount } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/staff/distinct
 * 返回已登记的单位(area)和部门/网格(gridName)去重列表，用于前端下拉
 */
router.get('/admin/staff/distinct', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const [areas, gridNames] = await Promise.all([
      User.distinct('area', { area: { $nin: [null, ''] } }),
      User.distinct('gridName', { gridName: { $nin: [null, ''] } })
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
 * 导出人员配置（CSV格式）
 */
router.get('/admin/staff/export', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 }).lean();

    // CSV 表头
    const headers = ['姓名', '手机号', '微信号', '飞书账号', '单位', '部门/网格', '工号', '人员属性', '角色', '状态'];

    // CSV 数据行
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
      u.active ? '启用' : '禁用'
    ]);

    // 转义CSV字段（处理逗号、引号等）
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

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=staff_config_${new Date().toISOString().slice(0,10).replace(/-/g, '')}.csv`);

    // 添加 BOM 以支持 Excel 打开 UTF-8 编码的 CSV
    res.send('\ufeff' + csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/staff/import
 * 导入人员配置（CSV格式）
 * 以姓名为索引：
 * 1. 若原系统已有相同姓名：
 *    - 原字段为空，现字段不为空 → 以导入数据为准修改
 *    - 原字段不为空，现字段为空 → 保留原字段
 * 2. 若原系统没有该姓名 → 新增该人员
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

    // 角色名称到代码映射
    const roleNameToCode = {
      '一线人员': 'FRONTLINE',
      '区县经理': 'DISTRICT_MANAGER',
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
      const row = data[i];
      const rowNum = i + 2; // 数据行从第2行开始（第1行是表头）

      try {
        const name = (row['姓名'] || '').trim();
        if (!name) {
          results.errors.push(`第${rowNum}行：姓名为空，跳过`);
          results.skipped++;
          continue;
        }

        const phone = (row['手机号'] || '').trim();
        const wxAccount = (row['微信号'] || '').trim();
        const feishuId = (row['飞书账号'] || '').trim();
        const area = (row['单位'] || '').trim();
        const gridName = (row['部门/网格'] || '').trim();
        const employeeId = (row['工号'] || '').trim();
        const staffType = (row['人员属性'] || '').trim();
        const rolesStr = (row['角色'] || '').trim();
        const statusStr = (row['状态'] || '').trim();

        // 解析角色
        let roles = [];
        if (rolesStr) {
          roles = rolesStr.split('/').map(r => {
            const trimmed = r.trim();
            return roleNameToCode[trimmed] || trimmed;
          }).filter(r => VALID_ROLES.includes(r));
        }

        // 按手机号查找（唯一约束，避免同名误覆盖）
        // 无手机号时降级按姓名模糊匹配（向后兼容）
        const existingUser = phone
          ? await User.findOne({ phone })
          : await User.findOne({ name: { $regex: new RegExp('^' + escapeRegex(name) + '$', 'i') } });
        const user = existingUser;

        if (user) {
          // 已有用户，按规则更新：
          // 原字段为空，现字段不为空 → 以导入数据为准修改
          // 原字段不为空，现字段为空 → 保留原字段
          if (phone && phone !== user.phone) {
            // 检查新手机号是否被占用
            const phoneExists = await User.findOne({ phone, _id: { $ne: user._id } });
            if (!phoneExists) {
              user.phone = phone;
            }
          }
          // 只有导入数据非空时才更新（保留原数据）
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
          // 新增用户
          logger.info(`导入未匹配到用户: ${name}，将新增`);
          if (!phone) {
            results.errors.push(`第${rowNum}行：新增用户手机号不能为空，跳过`);
            results.skipped++;
            continue;
          }

          // 检查手机号是否被占用
          const phoneExists = await User.findOne({ phone });
          if (phoneExists) {
            results.errors.push(`第${rowNum}行：手机号${phone}已被其他用户使用，跳过`);
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
            active: statusStr !== '禁用'
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
        message: `导入完成：新增${results.added}条，更新${results.updated}条，跳过${results.skipped}条`,
        details: results
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/demands/export
 * 导出工单列表为 xlsx（管理员）
 * 包含现场照片、资源照片、设计文件、施工照片、监理照片的完整 URL
 */
router.get('/admin/demands/export', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const { keyword, status, type, area, dateFrom, dateTo } = req.query;
    const query = {};
    // 区县过滤（ADMIN 可指定 ?district=xxx）
    Object.assign(query, getDistrictFilter(req));
    if (status) query.status = status;
    if (type) query.type = type;
    if (area) query.acceptArea = { $regex: escapeRegex(area), $options: 'i' };
    if (keyword) {
      const safeKw = escapeRegex(keyword);
      query.$or = [
        { demandNo: { $regex: safeKw, $options: 'i' } },
        { demandPersonName: { $regex: safeKw, $options: 'i' } },
        { locationDetail: { $regex: safeKw, $options: 'i' } }
      ];
    }
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        // dateTo 取当天结束时间（23:59:59）
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

    // 构建文件完整 URL 的基础地址：优先环境变量，次选从请求推断
    const serverBaseUrl = process.env.SERVER_BASE_URL ||
      `${req.protocol}://${req.get('host')}`;

    // 将相对路径 URL 补全为绝对 URL；外部 URL 保持不变
    const toAbsUrl = (url) => {
      if (!url) return '';
      return url.startsWith('http') ? url : serverBaseUrl + url;
    };

    // 将 URL 数组格式化为单元格文本（单文件直接用，多文件换行分隔）
    const fmtUrls = (arr) => {
      const urls = (arr || []).map(toAbsUrl).filter(Boolean);
      return urls.join('\n');
    };

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = '射洪建设支撑系统';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('工单列表', {
      views: [{ state: 'frozen', ySplit: 1 }]  // 冻结表头行
    });

    // ── 列定义：key 对应 row[key]，width 为列宽 ──────────────────────────
    ws.columns = [
      { header: '工单编号',     key: 'demandNo',              width: 20 },
      { header: '受理区域',     key: 'acceptArea',            width: 18 },
      { header: '网格',         key: 'gridName',              width: 16 },
      { header: '服务中心',     key: 'serviceCenter',         width: 18 },
      { header: '网络支撑中心', key: 'networkSupport',        width: 18 },
      { header: '申请人',       key: 'demandPersonName',      width: 12 },
      { header: '申请人电话',   key: 'demandPersonPhone',     width: 14 },
      { header: '提交人',       key: 'createdByName',         width: 12 },
      { header: '业务类型',     key: 'businessType',          width: 10 },
      { header: '需求类型',     key: 'type',                  width: 10 },
      { header: '预约客户数',   key: 'reservedCustomers',     width: 12 },
      { header: 'DP箱数量',     key: 'dpBoxCount',            width: 10 },
      { header: '紧急程度',     key: 'urgency',               width: 10 },
      { header: '详细地址',     key: 'locationDetail',        width: 30 },
      { header: '现场照片',     key: 'photos',                width: 50 },
      { header: '设计单位',     key: 'designUnit',            width: 14 },
      { header: '是否有资源',   key: 'hasResource',           width: 12 },
      { header: '资源名称',     key: 'resourceName',          width: 16 },
      { header: '资源照片',     key: 'resourcePhotos',        width: 50 },
      { header: '设计文件',     key: 'designFiles',           width: 50 },
      { header: '设计备注',     key: 'designRemark',          width: 20 },
      { header: '施工单位',     key: 'constructionUnit',      width: 14 },
      { header: '覆盖点名称',   key: 'coverageName',          width: 16 },
      { header: '资产状态',     key: 'assetStatus',           width: 12 },
      { header: '施工照片',     key: 'constructionPhotos',    width: 50 },
      { header: '施工备注',     key: 'constructionRemark',    width: 20 },
      { header: '监理单位',     key: 'supervisorUnit',        width: 14 },
      { header: '监理备注',     key: 'supervisorRemark',      width: 20 },
      { header: '监理验收时间', key: 'supervisorVerifyTime',  width: 18 },
      { header: '监理验收照片', key: 'supervisorPhotos',      width: 50 },
      { header: '确认人',       key: 'confirmByName',         width: 12 },
      { header: '确认时间',     key: 'confirmTime',           width: 18 },
      { header: '创建时间',     key: 'createdAt',             width: 18 },
      { header: '设计指派时间', key: 'designAssignTime',      width: 18 },
      { header: '施工指派时间', key: 'constructionAssignTime',width: 18 },
      { header: '完成时间',     key: 'completedTime',         width: 18 },
      { header: '总历时',       key: 'totalDuration',         width: 12 },
      { header: '设计历时',     key: 'designDuration',        width: 12 },
      { header: '施工历时',     key: 'constructionDuration',  width: 12 },
      { header: '最终状态',     key: 'status',                width: 12 },
      { header: '驳回次数',     key: 'rejectCount',           width: 10 },
      { header: '驳回原因',     key: 'rejectionReason',       width: 24 },
    ];

    // 表头行样式
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 28;

    // 附件列索引（1-based）：用于设置超链接样式
    const FILE_COL_KEYS = new Set(['photos', 'resourcePhotos', 'designFiles', 'constructionPhotos', 'supervisorPhotos']);

    // 写入数据行
    demands.forEach((d) => {
      const row = ws.addRow({
        demandNo:               d.demandNo || '',
        acceptArea:             d.acceptArea || '',
        gridName:               d.gridName || '',
        serviceCenter:          d.serviceCenter || '',
        networkSupport:         d.networkSupport || '',
        demandPersonName:       d.demandPersonName || '',
        demandPersonPhone:      d.demandPersonPhone || '',
        createdByName:          d.createdBy?.name || '',
        businessType:           d.businessType || '',
        type:                   d.type || '',
        reservedCustomers:      d.reservedCustomers ?? '',
        dpBoxCount:             d.dpBoxCount ?? '',
        urgency:                d.urgency || '',
        locationDetail:         d.locationDetail || '',
        photos:                 fmtUrls(d.photos),
        designUnit:             d.assignedDesignUnit?.name || '',
        hasResource:            d.hasResource == null ? '' : (d.hasResource ? '是（300m内）' : '否'),
        resourceName:           d.resourceName || '',
        resourcePhotos:         fmtUrls(d.resourcePhotos),
        designFiles:            fmtUrls(d.designFiles),
        designRemark:           d.designRemark || '',
        constructionUnit:       d.assignedConstructionUnit?.name || '',
        coverageName:           d.coverageName || '',
        assetStatus:            d.assetStatus || '',
        constructionPhotos:     fmtUrls(d.constructionPhotos),
        constructionRemark:     d.constructionRemark || '',
        supervisorUnit:         d.assignedSupervisor?.name || '',
        supervisorRemark:       d.supervisorRemark || '',
        supervisorVerifyTime:   fmtDate(d.supervisorVerifyTime),
        supervisorPhotos:       fmtUrls(d.supervisorPhotos),
        confirmByName:          d.confirmBy?.name || '',
        confirmTime:            fmtDate(d.confirmTime),
        createdAt:              fmtDate(d.createdAt),
        designAssignTime:       fmtDate(d.designAssignTime),
        constructionAssignTime: fmtDate(d.constructionAssignTime),
        completedTime:          fmtDate(d.completedTime),
        totalDuration:          fmtDuration(d.totalDuration),
        designDuration:         fmtDuration(d.designDuration),
        constructionDuration:   fmtDuration(d.constructionDuration),
        status:                 d.status || '',
        rejectCount:            d.rejectCount ?? 0,
        rejectionReason:        d.rejectionReason || '',
      });

      // 为附件列设置：文本换行、蓝色字体（提示可点击），单个 URL 设置超链接
      ws.columns.forEach((col, colIdx) => {
        if (!FILE_COL_KEYS.has(col.key)) return;
        const cell = row.getCell(colIdx + 1);
        const cellText = cell.value;
        if (!cellText) return;

        const urls = String(cellText).split('\n').filter(Boolean);
        cell.alignment = { wrapText: true, vertical: 'top' };

        if (urls.length === 1) {
          // 单个文件：设置超链接，显示文件名
          const url = urls[0];
          const fileName = url.split('/').pop() || url;
          cell.value = { text: fileName, hyperlink: url, tooltip: url };
          cell.font = { color: { argb: 'FF1890FF' }, underline: true };
        } else {
          // 多个文件：纯文本（Excel 会自动识别 http 链接）
          cell.font = { color: { argb: 'FF1890FF' } };
        }
      });

      row.alignment = { vertical: 'top', wrapText: false };
      row.height = 20;
    });

    // 输出 xlsx
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="demands_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
