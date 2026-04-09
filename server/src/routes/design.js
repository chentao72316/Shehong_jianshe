const express = require('express');
const Demand = require('../models/demand.model');
const AreaConfig = require('../models/area-config.model');
const User = require('../models/user.model');
const { createError } = require('../middleware/error-handler');
const { requireRole } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { notifyDesignComplete, notifyConstructionConfirm } = require('../utils/notify');
const { broadcastDemandUpdate } = require('../utils/websocket');
const { sendAssignMessages, sendStatusChangeMessages } = require('../utils/msgHelper');
const { recalculateDemandDurations } = require('../utils/demand-duration');

const router = express.Router();

/**
 * POST /api/design/submit
 * 设计单位提交查勘结果
 * hasResource=true  → 直接进入"待确认"（有现有资源，跳过施工）
 * hasResource=false → 进入"施工中"
 */
router.post('/design/submit', requireRole('DESIGN'), async (req, res, next) => {
  try {
    const { demandId, hasResource, resourceName, resourcePhotos, designFiles, remark } = req.body;

    const demand = await Demand.findById(demandId);
    if (!demand) throw createError(404, '需求不存在');
    if (demand.status !== '设计中') {
      throw createError(400, '需求当前状态不允许提交查勘结果');
    }
    if (String(demand.assignedDesignUnit) !== String(req.user._id) &&
        !req.user.roles.includes('ADMIN')) {
      throw createError(403, '无权操作此需求');
    }
    // 有资源时不需要设计图纸，无资源时必须上传设计图纸
    if (hasResource === false && (!designFiles || designFiles.length === 0)) {
      throw createError(400, '无资源时必须上传设计图纸');
    }

    const now = new Date();
    demand.hasResource = hasResource;
    demand.resourceName = resourceName || '';
    demand.resourcePhotos = resourcePhotos || [];
    demand.designFiles = designFiles || [];
    demand.designRemark = remark || '';

    if (hasResource) {
      demand.status = '待确认';
      // 查询该区域的网络支撑经理姓名，写入日志便于追踪
      const areaCfg = await AreaConfig.findOne({ acceptArea: demand.acceptArea, district: demand.district })
        .populate('networkManagerId', 'name').lean();
      const networkManagerStr = areaCfg?.networkManagerId?.name
        ? `，流转至网络支撑经理：${areaCfg.networkManagerId.name}`
        : '（待分配网络支撑经理）';
      demand.logs.push({
        content: `设计查勘完成，发现已有资源（${resourceName || ''}），需求直接进入开通确认状态${networkManagerStr}`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    } else {
      demand.status = '施工中';
      demand.constructionAssignTime = now;
      // 查询施工单位姓名，写入日志便于追踪
      let constructionStr = '';
      if (demand.assignedConstructionUnit) {
        const constructionUser = await User.findById(demand.assignedConstructionUnit, 'name').lean();
        if (constructionUser?.name) {
          constructionStr = `，流转至施工单位：${constructionUser.name}`;
        }
      }
      demand.logs.push({
        content: `设计查勘完成${designFiles && designFiles.length > 0 ? '，已上传' + designFiles.length + '张设计图纸' : ''}，需求进入施工中状态${constructionStr}`,
        operatorId: req.user._id,
        operatorName: req.user.name
      });
    }

    recalculateDemandDurations(demand, now);
    await demand.save();
    logger.info('设计查勘提交', { demandId, designBy: req.user._id, hasResource, designFileCount: designFiles ? designFiles.length : 0 });
    res.json({ code: 0, data: {} });

    // 异步发送飞书通知
    if (hasResource) {
      notifyConstructionConfirm(demand).catch(() => {});
      sendStatusChangeMessages(demand, [demand.createdBy], '设计查勘完成，您的工单等待开通确认').catch(() => {});
    } else {
      notifyDesignComplete(demand).catch(() => {});
      sendAssignMessages(demand, [demand.assignedConstructionUnit]).catch(() => {});
      sendStatusChangeMessages(demand, [demand.createdBy], '设计查勘完成，工单已进入施工阶段').catch(() => {});
    }

    const { syncDemandWithPopulate } = require('../utils/feishu-bitable');
    syncDemandWithPopulate(demand).catch(() => {});

    // 异步广播WebSocket通知
    broadcastDemandUpdate(demandId, {
      type: 'design_submit',
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
