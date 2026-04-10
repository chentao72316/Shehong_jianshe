const express = require('express');
const Demand = require('../models/demand.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { broadcastDemandUpdate } = require('../utils/websocket');

const router = express.Router();

/**
 * POST /api/supervisor/submit
 * 监理单位提交验收记录，不改变工单主状态，仅补充验收信息
 */
router.post('/supervisor/submit', requireRole('SUPERVISOR'), async (req, res, next) => {
  try {
    const { demandId, photos, remark } = req.body;

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (!['待确认', '已开通'].includes(demand.status)) {
      throw createError(400, '当前状态不允许提交监理验收信息');
    }
    if (String(demand.assignedSupervisor) !== String(req.user._id) &&
        !req.user.roles.includes('ADMIN')) {
      throw createError(403, '无权操作此需求');
    }

    demand.supervisorPhotos = photos || [];
    demand.supervisorRemark = remark || '';
    demand.supervisorVerifyTime = new Date();
    demand.logs.push({
      content: `监理已提交验收记录${demand.supervisorPhotos.length ? `，上传${demand.supervisorPhotos.length}张验收照片` : ''}`,
      operatorId: req.user._id,
      operatorName: req.user.name
    });

    await demand.save();
    logger.info('监理验收提交', { demandId, supervisorBy: req.user._id });
    res.json({
      code: 0,
      data: {
        supervisorVerifyTime: demand.supervisorVerifyTime
      }
    });

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    broadcastDemandUpdate(demandId, {
      type: 'supervisor_submit',
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
