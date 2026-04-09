const express = require('express');
const Demand = require('../models/demand.model');
const { requireRole } = require('../middleware/auth');
const { getDistrictFilter } = require('../utils/district');

const router = express.Router();

// 超时阈值（与 timeout-checker.service.js 保持一致）
const DESIGN_TIMEOUT_MS      = 2 * 24 * 60 * 60 * 1000;
const CONSTRUCTION_TIMEOUT_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * GET /api/stats/grid
 * 按网格统计需求数据
 */
router.get('/stats/grid', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'LEVEL4_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { range = 'month' } = req.query;
    const startDate = getStartDate(range);
    const roles = req.user.roles || [];

    const now = new Date();
    const designTimeoutCutoff      = new Date(now.getTime() - DESIGN_TIMEOUT_MS);
    const constructionTimeoutCutoff = new Date(now.getTime() - CONSTRUCTION_TIMEOUT_MS);

    const matchStage = { createdAt: { $gte: startDate }, ...getDistrictFilter(req) };
    if (roles.includes('GRID_MANAGER') && !roles.includes('ADMIN')) {
      matchStage.gridName = req.user.gridName;
    } else if (roles.includes('NETWORK_MANAGER') && !roles.includes('ADMIN')) {
      matchStage.acceptArea = req.user.area;
    } else if ((roles.includes('DEPT_MANAGER') || roles.includes('LEVEL4_MANAGER')) &&
               !roles.includes('ADMIN') && !roles.includes('DISTRICT_MANAGER')) {
      if (req.user.gridName && !req.user.gridName.includes('网络建设中心')) {
        matchStage.$or = [{ gridName: req.user.gridName }, { acceptArea: req.user.gridName }];
      }
    }

    const result = await Demand.aggregate([
      { $match: matchStage },
      { $addFields: {
        isTimeout: { $or: [
          { $and: [{ $eq: ['$status', '设计中'] }, { $lte: ['$designAssignTime', designTimeoutCutoff] }] },
          { $and: [{ $eq: ['$status', '施工中'] }, { $lte: ['$constructionAssignTime', constructionTimeoutCutoff] }] }
        ]}
      }},
      {
        $group: {
          _id: '$gridName',
          area: { $first: '$acceptArea' },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', '已开通'] }, 1, 0] } },
          existingResourceCompleted: { $sum: { $cond: [
            { $and: [
              { $eq: ['$status', '已开通'] },
              { $or: [
                { $eq: ['$completionMode', 'EXISTING_RESOURCE'] },
                { $and: [
                  { $in: ['$completionMode', [null, '']] },
                  { $eq: ['$hasResource', true] },
                  { $eq: ['$constructionAssignTime', null] },
                  { $in: ['$coverageName', [null, '']] }
                ] }
              ] }
            ] },
            1, 0
          ] } },
          constructionBuildCompleted: { $sum: { $cond: [
            { $and: [
              { $eq: ['$status', '已开通'] },
              { $or: [
                { $eq: ['$completionMode', 'CONSTRUCTION_BUILD'] },
                { $and: [
                  { $in: ['$completionMode', [null, '']] },
                  { $or: [
                    { $ne: ['$constructionAssignTime', null] },
                    { $ne: ['$coverageName', null] }
                  ] }
                ] }
              ] }
            ] },
            1, 0
          ] } },
          timeout: { $sum: { $cond: ['$isTimeout', 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', '已驳回'] }, 1, 0] } }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const list = result.map(item => ({
      gridName: item._id || '未分配',
      area: item.area || '',
      total: item.total,
      completed: item.completed,
      done: item.completed,
      existingResourceCompleted: item.existingResourceCompleted,
      existingResourceDone: item.existingResourceCompleted,
      constructionBuildCompleted: item.constructionBuildCompleted,
      constructionBuildDone: item.constructionBuildCompleted,
      timeout: item.timeout,
      completionRate: item.total > 0 ? item.completed / item.total : 0,
      doneRate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0
    }));
    res.json({ code: 0, data: list });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/area
 * 按区域统计需求数据
 */
router.get('/stats/area', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'LEVEL4_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { range = 'month' } = req.query;
    const startDate = getStartDate(range);
    const roles = req.user.roles || [];

    const now = new Date();
    const designTimeoutCutoff      = new Date(now.getTime() - DESIGN_TIMEOUT_MS);
    const constructionTimeoutCutoff = new Date(now.getTime() - CONSTRUCTION_TIMEOUT_MS);

    const matchStage = { createdAt: { $gte: startDate }, ...getDistrictFilter(req) };
    if (roles.includes('NETWORK_MANAGER') && !roles.includes('ADMIN')) {
      matchStage.acceptArea = req.user.area;
    } else if ((roles.includes('DEPT_MANAGER') || roles.includes('LEVEL4_MANAGER')) &&
               !roles.includes('ADMIN') && !roles.includes('DISTRICT_MANAGER')) {
      if (req.user.gridName && !req.user.gridName.includes('网络建设中心')) {
        matchStage.$or = [{ gridName: req.user.gridName }, { acceptArea: req.user.gridName }];
      }
    }

    const result = await Demand.aggregate([
      { $match: matchStage },
      { $addFields: {
        isTimeout: { $or: [
          { $and: [{ $eq: ['$status', '设计中'] }, { $lte: ['$designAssignTime', designTimeoutCutoff] }] },
          { $and: [{ $eq: ['$status', '施工中'] }, { $lte: ['$constructionAssignTime', constructionTimeoutCutoff] }] }
        ]}
      }},
      {
        $group: {
          _id: '$acceptArea',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', '已开通'] }, 1, 0] } },
          existingResourceCompleted: { $sum: { $cond: [
            { $and: [
              { $eq: ['$status', '已开通'] },
              { $or: [
                { $eq: ['$completionMode', 'EXISTING_RESOURCE'] },
                { $and: [
                  { $in: ['$completionMode', [null, '']] },
                  { $eq: ['$hasResource', true] },
                  { $eq: ['$constructionAssignTime', null] },
                  { $in: ['$coverageName', [null, '']] }
                ] }
              ] }
            ] },
            1, 0
          ] } },
          constructionBuildCompleted: { $sum: { $cond: [
            { $and: [
              { $eq: ['$status', '已开通'] },
              { $or: [
                { $eq: ['$completionMode', 'CONSTRUCTION_BUILD'] },
                { $and: [
                  { $in: ['$completionMode', [null, '']] },
                  { $or: [
                    { $ne: ['$constructionAssignTime', null] },
                    { $ne: ['$coverageName', null] }
                  ] }
                ] }
              ] }
            ] },
            1, 0
          ] } },
          inProgress: {
            $sum: {
              $cond: [
                { $not: [{ $in: ['$status', ['已开通', '已驳回', '待审核']] }] },
                1, 0
              ]
            }
          },
          timeout: { $sum: { $cond: ['$isTimeout', 1, 0] } }
        }
      },
      { $sort: { total: -1 } }
    ]);

    const list = result.map(item => ({
      area: item._id || '未分配',
      total: item.total,
      completed: item.completed,
      done: item.completed,
      existingResourceCompleted: item.existingResourceCompleted,
      existingResourceDone: item.existingResourceCompleted,
      constructionBuildCompleted: item.constructionBuildCompleted,
      constructionBuildDone: item.constructionBuildCompleted,
      inProgress: item.inProgress,
      timeout: item.timeout,
      completionRate: item.total > 0 ? item.completed / item.total : 0,
      doneRate: item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0
    }));
    res.json({ code: 0, data: list });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/stats/status-summary
 * 按工单状态汇总，用于状态分布饼图
 */
router.get('/stats/status-summary', requireRole('GRID_MANAGER', 'NETWORK_MANAGER', 'LEVEL4_MANAGER', 'DISTRICT_MANAGER', 'DEPT_MANAGER', 'ADMIN'), async (req, res, next) => {
  try {
    const { range = 'month' } = req.query;
    const startDate = getStartDate(range);
    const roles = req.user.roles || [];

    const matchStage = { createdAt: { $gte: startDate }, ...getDistrictFilter(req) };
    if (roles.includes('NETWORK_MANAGER') && !roles.includes('ADMIN')) {
      matchStage.acceptArea = req.user.area;
    } else if ((roles.includes('DEPT_MANAGER') || roles.includes('LEVEL4_MANAGER')) &&
               !roles.includes('ADMIN') && !roles.includes('DISTRICT_MANAGER')) {
      if (req.user.gridName && !req.user.gridName.includes('网络建设中心')) {
        matchStage.$or = [{ gridName: req.user.gridName }, { acceptArea: req.user.gridName }];
      }
    }

    const result = await Demand.aggregate([
      { $match: matchStage },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const list = result.map(item => ({
      status: item._id,
      count: item.count
    }));
    res.json({ code: 0, data: list });
  } catch (err) {
    next(err);
  }
});

/**
 * 根据时间范围返回起始日期
 */
function getStartDate(range) {
  const now = new Date();
  switch (range) {
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'quarter': {
      const q = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), q * 3, 1);
    }
    case 'year':
      return new Date(now.getFullYear(), 0, 1);
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
}

module.exports = router;
