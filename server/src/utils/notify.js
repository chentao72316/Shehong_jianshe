/**
 * notify.js
 * 飞书群消息通知 - 9种业务场景的统一入口
 * 依赖 sendGroupMessage（开放API，支持@人）
 */
const User = require('../models/user.model');
const { sendGroupMessage } = require('./feishu');
const { logger } = require('./logger');
const { fmtDate, fmtDuration, minutesBetween } = require('./format');
const { getAssignmentIds, uniqueIds } = require('./demand-assignment');

const CHAT_ID = process.env.FEISHU_CHAT_ID;

/**
 * 紧急度标签
 */
function urgencyLabel(urgency) {
  if (urgency === '特急') return '🔴 特急';
  if (urgency === '紧急') return '🟡 紧急';
  return '⚪ 普通';
}

/**
 * 批量查询用户的 feishuId
 */
async function getFeishuIds(userIds) {
  if (!userIds || !userIds.length) return [];
  const validIds = uniqueIds(userIds);
  if (!validIds.length) return [];
  const users = await User.find({ _id: { $in: validIds } }).select('feishuId');
  return users.map(u => u.feishuId).filter(Boolean);
}

/**
 * 查询某区域某角色的 feishuId 列表
 */
async function getAreaRoleFeishuIds(area, gridName, roles) {
  const query = { roles: { $in: roles }, active: true };
  if (gridName) query.gridName = gridName;
  else if (area) query.area = area;
  const users = await User.find(query).select('feishuId');
  return users.map(u => u.feishuId).filter(Boolean);
}

/**
 * 场景1：新需求录入 → @设计 @施工 @监理 @网格经理 @网络支撑经理
 */
async function notifyNewDemand(demand) {
  try {
    const mentionIds = await getFeishuIds([
      ...getAssignmentIds(demand, 'assignedDesignUnit', 'assignedDesignUnits'),
      ...getAssignmentIds(demand, 'assignedConstructionUnit', 'assignedConstructionUnits'),
      ...getAssignmentIds(demand, 'assignedSupervisor', 'assignedSupervisors')
    ]);
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['GRID_MANAGER', 'NETWORK_MANAGER']);

    const designUnit = demand.assignedDesignUnit?.name || demand.assignedDesignUnit || '-';
    const constructionUnit = demand.assignedConstructionUnit?.name || demand.assignedConstructionUnit || '-';
    const supervisorUnit = demand.assignedSupervisor?.name || demand.assignedSupervisor || '-';

    const content = [
      `**📋 基本信息**`,
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea} · 网格：${demand.gridName || '-'}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      `紧急程度：${urgencyLabel(demand.urgency)}`,
      ``,
      `**👤 申请人信息**`,
      `姓名：${demand.demandPersonName || '-'}　电话：${demand.demandPersonPhone || '-'}`,
      `详细地址：${demand.locationDetail}`,
      ``,
      `**📊 需求详情**`,
      `预约客户数：${demand.reservedCustomers ?? '-'}户　DP箱：${demand.dpBoxCount ?? '-'}个`,
      demand.remark ? `备注：${demand.remark}` : '',
      ``,
      `**🏢 指派单位**`,
      `设计单位：${designUnit}`,
      `施工单位：${constructionUnit}`,
      `监理单位：${supervisorUnit}`,
      ``,
      `📅 创建时间：${fmtDate(demand.createdAt)}`
    ].filter(line => line !== '').join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【🆕 新建工单】#${demand.demandNo}`,
      content,
      [...new Set([...mentionIds, ...managerIds])],
      'blue'
    );
  } catch (err) {
    logger.error('场景1通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景2：需求驳回 → @提交人 @监理 @网格经理 @网络支撑经理
 */
async function notifyRejected(demand, rejectedByName) {
  try {
    const mentionIds = await getFeishuIds([demand.createdBy, ...getAssignmentIds(demand, 'assignedSupervisor', 'assignedSupervisors')]);
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['GRID_MANAGER', 'NETWORK_MANAGER']);

    const content = [
      `**📋 工单信息**`,
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      `当前状态：已驳回`,
      ``,
      `**🚫 驳回详情**`,
      `驳回类型：${demand.rejectType || '-'}`,
      `驳回原因：${demand.rejectionReason || '-'}`,
      `驳回时间：${fmtDate(demand.rejectionTime)}`,
      `驳回人：${rejectedByName || '-'}`,
      `累计驳回次数：第${demand.rejectCount || 1}次`,
      ``,
      `⚡ 请申请人确认后重新提交`
    ].join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【❌ 工单驳回】#${demand.demandNo}`,
      content,
      [...new Set([...mentionIds, ...managerIds])],
      'red'
    );
  } catch (err) {
    logger.error('场景2通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景3：设计完成 → @施工 @监理 @网格经理 @网络支撑经理
 */
async function notifyDesignComplete(demand) {
  try {
    const mentionIds = await getFeishuIds([
      ...getAssignmentIds(demand, 'assignedConstructionUnit', 'assignedConstructionUnits'),
      ...getAssignmentIds(demand, 'assignedSupervisor', 'assignedSupervisors')
    ]);
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['GRID_MANAGER', 'NETWORK_MANAGER']);

    const designDuration = minutesBetween(demand.designAssignTime, new Date());

    const content = [
      `**📋 工单信息**`,
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      ``,
      `**🔍 设计勘察结果**`,
      `是否有资源：${demand.hasResource ? '✅ 有（300m内）' : '❌ 无'}`,
      demand.resourceName ? `资源名称：${demand.resourceName}` : '',
      `设计备注：${demand.designRemark || '-'}`,
      `设计图纸：已上传（${(demand.designFiles || []).length}张）`,
      ``,
      `**⏱ 时间信息**`,
      `设计历时：${fmtDuration(designDuration)}`,
      `勘察完成时间：${fmtDate(new Date())}`,
      ``,
      `⚡ 请施工单位开始施工`
    ].filter(line => line !== '').join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【✅ 设计勘察完成】#${demand.demandNo}`,
      content,
      [...new Set([...mentionIds, ...managerIds])],
      'green'
    );
  } catch (err) {
    logger.error('场景3通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景4：施工完成待网格经理确认 → @网格经理 @网络支撑经理
 */
async function notifyConstructionConfirm(demand) {
  try {
    const mentionIds = await getFeishuIds(getAssignmentIds(demand, 'assignedSupervisor', 'assignedSupervisors'));
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['NETWORK_MANAGER']);

    const constructionDuration = minutesBetween(demand.constructionAssignTime, new Date());

    const content = [
      `**📋 工单信息**`,
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea} · 网格：${demand.gridName || '-'}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      ``,
      `**🏗 施工信息**`,
      `施工单位：${demand.assignedConstructionUnit?.name || '-'}`,
      `覆盖点名称：${demand.coverageName || '-'}`,
      `资产状态：${demand.assetStatus || '-'}`,
      `施工现场照片：已上传（${(demand.constructionPhotos || []).length}张）`,
      demand.constructionRemark ? `施工备注：${demand.constructionRemark}` : '',
      ``,
      `**⏱ 时间信息**`,
      `施工历时：${fmtDuration(constructionDuration)}`,
      `完工时间：${fmtDate(new Date())}`,
      ``,
      `⚡ 请监理单位前往现场验收`
    ].filter(line => line !== '').join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【🔨 施工完成·待验收】#${demand.demandNo}`,
      content,
      [...new Set([...mentionIds, ...managerIds])],
      'blue'
    );
  } catch (err) {
    logger.error('场景4通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景6：需求开通 → @提交人 @网络支撑经理
 */
async function notifyDemandCompleted(demand) {
  try {
    const mentionIds = await getFeishuIds([demand.createdBy]);
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['NETWORK_MANAGER']);

    const designLabel = demand.designDuration != null
      ? `${fmtDuration(demand.designDuration)}${demand.designDuration <= 2880 ? '（达标 ≤2天）' : '（超时）'}`
      : '-';
    const constructionLabel = demand.constructionDuration != null
      ? `${fmtDuration(demand.constructionDuration)}${demand.constructionDuration <= 7200 ? '（达标 ≤5天）' : '（超时）'}`
      : '-';
    const confirmName = demand.confirmBy?.name || demand.confirmBy || '-';

    const content = [
      `**📋 工单摘要**`,
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      `覆盖点名称：${demand.coverageName || '-'}`,
      `预约客户数：${demand.reservedCustomers ?? '-'}户`,
      ``,
      `**⏱ 全流程耗时统计**`,
      `创建时间：${fmtDate(demand.createdAt)}`,
      `完成时间：${fmtDate(demand.completedTime)}`,
      `总历时：${fmtDuration(demand.totalDuration)}`,
      `设计历时：${designLabel}`,
      `施工历时：${constructionLabel}`,
      ``,
      `✅ 确认人：${confirmName}`
    ].join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【🎉 工单已开通】#${demand.demandNo}`,
      content,
      [...new Set([...mentionIds, ...managerIds])],
      'green'
    );
  } catch (err) {
    logger.error('场景6通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景7：设计即将超时（>1.5天）→ @设计单位
 */
async function notifyDesignWarning(demand) {
  try {
    const mentionIds = await getFeishuIds(getAssignmentIds(demand, 'assignedDesignUnit', 'assignedDesignUnits'));
    const elapsed = minutesBetween(demand.designAssignTime, new Date());

    const content = [
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      `当前状态：${demand.status}`,
      ``,
      `**⏰ 超时详情**`,
      `设计指派时间：${fmtDate(demand.designAssignTime)}`,
      `已历时：${fmtDuration(elapsed)}（超预警线1.5天）`,
      `距超时上限：约12小时`,
      ``,
      `⚡ 请设计单位加快完成勘察`
    ].join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【⚠️ 设计超时预警】#${demand.demandNo}`,
      content,
      mentionIds,
      'orange'
    );
  } catch (err) {
    logger.error('场景7通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景8：施工紧急督办（>4天）→ @施工 @监理 @网格经理 @网络支撑经理
 */
async function notifyConstructionUrgent(demand) {
  try {
    const mentionIds = await getFeishuIds([
      ...getAssignmentIds(demand, 'assignedConstructionUnit', 'assignedConstructionUnits'),
      ...getAssignmentIds(demand, 'assignedSupervisor', 'assignedSupervisors')
    ]);
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['GRID_MANAGER', 'NETWORK_MANAGER']);
    const elapsed = minutesBetween(demand.constructionAssignTime, new Date());

    const content = [
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      `当前状态：${demand.status}`,
      ``,
      `**⏰ 超时详情**`,
      `施工开始时间：${fmtDate(demand.constructionAssignTime)}`,
      `已历时：${fmtDuration(elapsed)}（严重超时 >4天）`,
      `距整体超时：约24小时`,
      ``,
      `⚡ 紧急督办，请立即处理！`
    ].join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【🚨 施工严重超时】#${demand.demandNo}`,
      content,
      [...new Set([...mentionIds, ...managerIds])],
      'red'
    );
  } catch (err) {
    logger.error('场景8通知失败', { demandId: demand._id, error: err.message });
  }
}

/**
 * 场景9：工单整体超时（>7天）→ @网格经理 @网络支撑经理
 */
async function notifyOverallTimeout(demand) {
  try {
    const managerIds = await getAreaRoleFeishuIds(demand.acceptArea, demand.gridName, ['GRID_MANAGER', 'NETWORK_MANAGER']);
    const elapsed = minutesBetween(demand.createdAt, new Date());

    const content = [
      `工单编号：${demand.demandNo}`,
      `受理区域：${demand.acceptArea}`,
      `业务类型：${demand.businessType} · ${demand.type}`,
      `当前状态：${demand.status}`,
      ``,
      `**⏰ 超时详情**`,
      `创建时间：${fmtDate(demand.createdAt)}`,
      `已历时：${fmtDuration(elapsed)}（超7天整体超时线）`,
      `当前环节：${demand.status}`,
      ``,
      `⚡ 请相关负责人立即介入处理！`
    ].join('\n');

    await sendGroupMessage(
      CHAT_ID,
      `【🚨 工单整体超时】#${demand.demandNo}`,
      content,
      managerIds,
      'red'
    );
  } catch (err) {
    logger.error('场景9通知失败', { demandId: demand._id, error: err.message });
  }
}

module.exports = {
  notifyNewDemand,
  notifyRejected,
  notifyDesignComplete,
  notifyConstructionConfirm,
  notifyDemandCompleted,
  notifyDesignWarning,
  notifyConstructionUrgent,
  notifyOverallTimeout
};
