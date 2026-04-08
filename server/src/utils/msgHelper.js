/**
 * msgHelper.js
 * 工单流转站内消息发送工具
 * 统一封装 Message.insertMany，失败只记日志，不阻塞主流程
 */
const Message = require('../models/message.model');
const { logger } = require('./logger');

/**
 * 批量写入站内消息（忽略重复/部分失败）
 */
async function bulkSend(messages) {
  const valid = messages.filter(m => m.recipientId);
  if (!valid.length) return;
  try {
    await Message.insertMany(valid, { ordered: false });
  } catch (err) {
    logger.error('站内消息批量发送失败', { error: err.message });
  }
}

function buildMsg(recipientId, title, content, type, demand) {
  return {
    recipientId,
    title,
    content,
    type,
    demandId: demand._id,
    demandNo: demand.demandNo
  };
}

/**
 * 指派消息：通知所有被指派人
 * @param {Object} demand
 * @param {Array}  recipientIds  - ObjectId 数组（可含 null，会被过滤）
 */
async function sendAssignMessages(demand, recipientIds) {
  const msgs = (recipientIds || [])
    .filter(Boolean)
    .map(rid => buildMsg(
      rid,
      `【工单指派】${demand.demandNo}`,
      `您已被指派处理工单 ${demand.demandNo}（${demand.acceptArea} · ${demand.type}），请及时跟进。`,
      'assign',
      demand
    ));
  await bulkSend(msgs);
}

/**
 * 状态变更消息：通知相关人员
 * @param {Object} demand
 * @param {Array}  recipientIds
 * @param {string} statusDesc   - 变更描述，如 "已确认开通"
 */
async function sendStatusChangeMessages(demand, recipientIds, statusDesc) {
  const msgs = (recipientIds || [])
    .filter(Boolean)
    .map(rid => buildMsg(
      rid,
      `【状态更新】${demand.demandNo}`,
      `工单 ${demand.demandNo}（${demand.acceptArea}）${statusDesc}`,
      'status_change',
      demand
    ));
  await bulkSend(msgs);
}

/**
 * 驳回消息：通知工单创建人
 * @param {Object} demand
 * @param {string} reason  - 驳回原因
 */
async function sendRejectMessage(demand, reason) {
  if (!demand.createdBy) return;
  await bulkSend([buildMsg(
    demand.createdBy,
    `【工单驳回】${demand.demandNo}`,
    `您提交的工单 ${demand.demandNo}（${demand.acceptArea}）已被驳回。驳回原因：${reason || '-'}`,
    'reject',
    demand
  )]);
}

/**
 * 催办消息：通知责任单位
 * @param {Object} demand
 * @param {*}      recipientId  - ObjectId
 * @param {string} senderName   - 催办人姓名
 */
async function sendRemindMessage(demand, recipientId, senderName) {
  if (!recipientId) return;
  await bulkSend([buildMsg(
    recipientId,
    `【催办提醒】${demand.demandNo}`,
    `工单 ${demand.demandNo}（${demand.acceptArea}）当前状态 ${demand.status} 已超时，${senderName || '管理员'}发起催办，请立即处理！`,
    'remind',
    demand
  )]);
}

module.exports = { sendAssignMessages, sendStatusChangeMessages, sendRejectMessage, sendRemindMessage };
