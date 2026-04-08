const express = require('express');
const Demand = require('../models/demand.model');
const AreaConfig = require('../models/area-config.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { broadcastDemandUpdate } = require('../utils/websocket');
const { sendStatusChangeMessages } = require('../utils/msgHelper');

const router = express.Router();

/**
 * POST /api/construction/start
 * 施工单位确认开始施工（记录开始时间）
 */
router.post('/construction/start', requireRole('CONSTRUCTION'), async (req, res, next) => {
  try {
    const { demandId } = req.body;

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '施工中') {
      throw createError(400, '需求当前状态不允许开始施工');
    }
    if (String(demand.assignedConstructionUnit) !== String(req.user._id) &&
        !req.user.roles.includes('ADMIN')) {
      throw createError(403, '无权操作此需求');
    }

    demand.logs.push({
      content: '施工单位已开始施工',
      operatorId: req.user._id,
      operatorName: req.user.name
    });

    await demand.save();
    logger.info('施工开始', { demandId, constructionBy: req.user._id });
    res.json({ code: 0, data: {} });

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    // 异步广播WebSocket通知
    broadcastDemandUpdate(demandId, {
      type: 'construction_start',
      demandId,
      demandNo: demand.demandNo,
      status: demand.status,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/construction/submit
 * 施工单位提交施工结果（施工中→待确认）
 * 施工完成后需网络支撑经理确认才能开通
 */
router.post('/construction/submit', requireRole('CONSTRUCTION'), async (req, res, next) => {
  try {
    const { demandId, coverageName, assetStatus, location, photos, remark } = req.body;

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '施工中') {
      throw createError(400, '需求当前状态不允许提交施工结果');
    }
    if (String(demand.assignedConstructionUnit) !== String(req.user._id) &&
        !req.user.roles.includes('ADMIN')) {
      throw createError(403, '无权操作此需求');
    }
    if (!coverageName || !assetStatus) {
      throw createError(400, '覆盖点名称和资产状态为必填项');
    }

    demand.coverageName = coverageName;
    demand.assetStatus = assetStatus;
    if (location) {
      demand.constructionLat = location.latitude;
      demand.constructionLng = location.longitude;
    }
    demand.constructionPhotos = photos || [];
    demand.constructionRemark = remark;

    // 施工完成，流转为待网络支撑经理确认
    demand.status = '待确认';
    // 查询该区域的网络支撑经理姓名，写入日志便于追踪
    const areaCfg = await AreaConfig.findOne({ acceptArea: demand.acceptArea, district: demand.district })
      .populate('networkManagerId', 'name').lean();
    const networkManagerStr = areaCfg?.networkManagerId?.name
      ? `：${areaCfg.networkManagerId.name}`
      : '（未配置网络支撑经理）';
    demand.logs.push({
      content: `施工完成，等待网络支撑经理${networkManagerStr}确认开通`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });

    await demand.save();
    logger.info('施工提交', { demandId, constructionBy: req.user._id, status: demand.status });
    res.json({ code: 0, data: { status: demand.status } });

    // 异步发送飞书通知网格经理确认
    const { notifyConstructionConfirm } = require('../utils/notify');
    notifyConstructionConfirm(demand).catch(() => {});
    sendStatusChangeMessages(demand, [demand.createdBy], '施工已完成，等待开通确认').catch(() => {});

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    // 异步广播WebSocket通知
    broadcastDemandUpdate(demandId, {
      type: 'construction_submit',
      demandId,
      demandNo: demand.demandNo,
      status: demand.status,
      assignedDesignUnit: demand.assignedDesignUnit,
      assignedConstructionUnit: demand.assignedConstructionUnit,
      assignedSupervisor: demand.assignedSupervisor
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
