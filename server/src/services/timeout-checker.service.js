/**
 * timeout-checker.service.js
 * 定时检查需求是否超时并更新状态
 *
 * 超时规则：
 * - 设计中：designAssignTime 起 2天（48小时）
 * - 施工中：constructionAssignTime 起 5天（120小时）
 *
 * 预警规则：
 * - 设计 >1.5天 → 预警（不改状态）
 * - 施工 >4天   → 紧急督办（不改状态）
 *
 * 去重策略：每条超时工单至多每6小时通知一次（lastDesignTimeoutNotifyAt / lastConstructionTimeoutNotifyAt）
 */
const Demand = require('../models/demand.model');
const Message = require('../models/message.model');
const User = require('../models/user.model');
const { sendTimeoutRemind } = require('../utils/feishu');
const { notifyDesignWarning, notifyConstructionUrgent } = require('../utils/notify');
const { logger } = require('../utils/logger');

const DESIGN_WARNING_MS       = 1.5 * 24 * 60 * 60 * 1000; // 36h
const DESIGN_TIMEOUT_MS       = 2   * 24 * 60 * 60 * 1000; // 48h
const CONSTRUCTION_URGENT_MS  = 4   * 24 * 60 * 60 * 1000; // 96h
const CONSTRUCTION_TIMEOUT_MS = 5   * 24 * 60 * 60 * 1000; // 120h

// 超时通知最小间隔：6小时（每轮检查10分钟，6h = 36轮，防止日志和飞书消息爆炸）
const NOTIFY_INTERVAL_MS = 6 * 60 * 60 * 1000;

async function runTimeoutCheck() {
  const now = new Date();
  let processed = 0;

  try {
    const notifyThreshold = new Date(now.getTime() - NOTIFY_INTERVAL_MS);

    // 设计即将超时预警（>1.5天，状态仍为设计中，尚未触发超时）
    const designWarnCutoff    = new Date(now.getTime() - DESIGN_WARNING_MS);
    const designTimeoutCutoff = new Date(now.getTime() - DESIGN_TIMEOUT_MS);
    const designWarnDemands = await Demand.find({
      status: '设计中',
      designAssignTime: { $lte: designWarnCutoff, $gt: designTimeoutCutoff },
      // 近6小时内未发送过预警通知
      $or: [
        { lastDesignTimeoutNotifyAt: { $exists: false } },
        { lastDesignTimeoutNotifyAt: { $lt: notifyThreshold } }
      ]
    });
    for (const demand of designWarnDemands) {
      notifyDesignWarning(demand).catch(e =>
        logger.error('设计预警通知失败', { demandId: demand._id, error: e.message })
      );
      demand.lastDesignTimeoutNotifyAt = now;
      await demand.save();
    }

    // 设计超时（>2天，发送超时提醒通知）
    const designDemands = await Demand.find({
      status: '设计中',
      designAssignTime: { $lte: designTimeoutCutoff },
      $or: [
        { lastDesignTimeoutNotifyAt: { $exists: false } },
        { lastDesignTimeoutNotifyAt: { $lt: notifyThreshold } }
      ]
    })
      .populate('assignedDesignUnit', 'name feishuId')
      .populate('assignedDesignUnits', 'name feishuId');

    for (const demand of designDemands) {
      demand.logs.push({
        content: '系统检测：设计环节已超过2天，请尽快完成',
        operatorId: null,
        operatorName: '系统'
      });
      demand.lastDesignTimeoutNotifyAt = now;
      await demand.save();
      processed++;
      if (demand.assignedDesignUnit) {
        sendTimeoutRemind(demand, demand.assignedDesignUnit).catch(e =>
          logger.error('飞书超时提醒失败', { demandId: demand._id, error: e.message })
        );
      }
      await notifyGridManagers(demand);
    }

    // 施工紧急督办预警（>4天，状态仍为施工中，尚未触发超时）
    const constructionUrgentCutoff  = new Date(now.getTime() - CONSTRUCTION_URGENT_MS);
    const constructionTimeoutCutoff = new Date(now.getTime() - CONSTRUCTION_TIMEOUT_MS);
    const constructionUrgentDemands = await Demand.find({
      status: '施工中',
      constructionAssignTime: { $lte: constructionUrgentCutoff, $gt: constructionTimeoutCutoff },
      $or: [
        { lastConstructionTimeoutNotifyAt: { $exists: false } },
        { lastConstructionTimeoutNotifyAt: { $lt: notifyThreshold } }
      ]
    });
    for (const demand of constructionUrgentDemands) {
      notifyConstructionUrgent(demand).catch(e =>
        logger.error('施工紧急督办通知失败', { demandId: demand._id, error: e.message })
      );
      demand.lastConstructionTimeoutNotifyAt = now;
      await demand.save();
    }

    // 施工超时（>5天，发送超时提醒通知）
    const constructionDemands = await Demand.find({
      status: '施工中',
      constructionAssignTime: { $lte: constructionTimeoutCutoff },
      $or: [
        { lastConstructionTimeoutNotifyAt: { $exists: false } },
        { lastConstructionTimeoutNotifyAt: { $lt: notifyThreshold } }
      ]
    })
      .populate('assignedConstructionUnit', 'name feishuId')
      .populate('assignedConstructionUnits', 'name feishuId');

    for (const demand of constructionDemands) {
      demand.logs.push({
        content: '系统检测：施工环节已超过5天，请尽快完成',
        operatorId: null,
        operatorName: '系统'
      });
      demand.lastConstructionTimeoutNotifyAt = now;
      await demand.save();
      processed++;
      if (demand.assignedConstructionUnit) {
        sendTimeoutRemind(demand, demand.assignedConstructionUnit).catch(e =>
          logger.error('飞书超时提醒失败', { demandId: demand._id, error: e.message })
        );
      }
      await notifyGridManagers(demand);
    }

    if (processed > 0) {
      logger.info('超时检查完成', { processed });
    }
  } catch (err) {
    logger.error('超时检查异常', { error: err.message });
  }
}

async function notifyGridManagers(demand) {
  try {
    const query = {
      roles: { $in: ['GRID_MANAGER', 'NETWORK_MANAGER'] },
      active: true
    };
    if (demand.gridName) query.gridName = demand.gridName;

    const managers = await User.find(query).select('_id');
    if (!managers.length) return;

    const messages = managers.map(m => ({
      recipientId: m._id,
      title: '需求超时提醒',
      content: `需求 ${demand.demandNo}（${demand.acceptArea}）已超时，当前状态：${demand.status}`,
      demandId: demand._id,
      type: 'TIMEOUT_ALERT'
    }));

    await Message.insertMany(messages);
  } catch (err) {
    logger.error('超时通知发送失败', { demandId: demand._id, error: err.message });
  }
}

module.exports = require('./auto-reminder.service');
