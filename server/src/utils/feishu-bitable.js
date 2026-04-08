/**
 * feishu-bitable.js
 * 飞书多维表格同步工具
 * 将工单完整信息写入飞书多维表格（Upsert：以 demandNo 为唯一键）
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { getTenantAccessToken, uploadFileToDrive } = require('./feishu');
const { logger } = require('./logger');
const { fmtDate, fmtDuration } = require('./format');

const BITABLE_BASE_URL = 'https://open.feishu.cn/open-apis/bitable/v1';

// 上传目录：server/uploads（相对于 server/src/utils，往上两级）
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// 内存缓存：localFilePath → file_token，避免同一会话内重复上传
const fileTokenCache = new Map();

/**
 * 查询多维表格中是否已有该工单记录，返回 record_id 或 null
 */
async function findRecordByDemandNo(token, appToken, tableId, demandNo) {
  try {
    const res = await axios.get(
      `${BITABLE_BASE_URL}/apps/${appToken}/tables/${tableId}/records`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          filter: `CurrentValue.[工单编号]="${demandNo}"`,
          page_size: 1
        }
      }
    );
    const items = res.data?.data?.items;
    if (items && items.length > 0) {
      return items[0].record_id;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 将 URL 数组上传至飞书 Drive，返回 [{ file_token }] 数组
 * - 相对路径（/uploads/...）从本地读取文件上传
 * - 外部 URL（http://...）无法本地读取，跳过
 * - 上传失败时静默跳过，不中断整体同步
 * @param {string[]} urls
 * @param {string} appToken - Bitable app_token
 * @returns {Promise<Array<{file_token: string}>>}
 */
async function uploadAttachments(urls, appToken) {
  if (!urls || urls.length === 0) return [];
  const results = [];
  for (const url of urls) {
    if (!url || url.startsWith('http')) continue; // 外部 URL 无法从本地读取
    const relativePath = url.replace(/^\/uploads/, '');
    const localPath = path.join(UPLOADS_DIR, relativePath);
    // 内存缓存命中
    if (fileTokenCache.has(localPath)) {
      results.push({ file_token: fileTokenCache.get(localPath) });
      continue;
    }
    const fileName = path.basename(localPath);
    const token = await uploadFileToDrive(localPath, fileName, appToken);
    if (token) {
      fileTokenCache.set(localPath, token);
      results.push({ file_token: token });
    }
  }
  return results;
}

/**
 * 构建飞书多维表格字段对象（严格对应表格列名和类型）
 * 表格字段类型参考：多维表格新建字段及类型.md
 * 注意：
 *   - 数字类型字段（预约客户数/DP箱数量/纬度/经度/驳回次数）有值才写，避免传字符串导致 API 报错
 *   - 单选类型字段（业务类型/需求类型/紧急程度/资产状态/最终状态）只传表格已有选项值
 *   - 最终状态只在工单到达终态（已开通/已驳回）时写入，过程中不写
 *   - 现场照片/资源照片/设计文件/施工照片/监理照片：上传到飞书 Drive 后写附件字段
 *     多维表格中这5列需手动设置为"附件"类型
 */
async function buildFields(demand, appToken) {
  const logsText = (demand.logs || [])
    .map(l => `[${fmtDate(l.createdAt)}] ${l.operatorName || ''}: ${l.content}`)
    .join('\n');

  const fields = {
    // ── 基本信息 ─────────────────────────────────────
    '工单编号':     demand.demandNo || '-',
    '受理区域':     demand.acceptArea || '-',
    '网格':         demand.gridName || '-',
    '服务中心':     demand.serviceCenter || '-',
    '网络支撑中心': demand.networkSupport || '-',
    '申请人姓名':   demand.demandPersonName || '-',
    '申请人电话':   demand.demandPersonPhone || '-',
    '提交人':       typeof demand.createdBy === 'object' ? (demand.createdBy?.name || '-') : '-',
    '详细地址':     demand.locationDetail || '-',
    '创建时间':     fmtDate(demand.createdAt),
    // ── 单选字段（只传有效选项值，null/undefined 则不写该字段） ──
    '业务类型':     demand.businessType || null,
    '需求类型':     demand.type || null,
    '紧急程度':     demand.urgency || '普通',
    // ── 设计环节 ─────────────────────────────────────
    '设计单位':     typeof demand.assignedDesignUnit === 'object' ? (demand.assignedDesignUnit?.name || '-') : '-',
    '设计指派时间': fmtDate(demand.designAssignTime),
    '是否有资源':   demand.hasResource == null ? '-' : (demand.hasResource ? '是（300m内）' : '否'),
    '资源名称':     demand.resourceName || '-',
    '设计备注':     demand.designRemark || '-',
    '设计历时':     fmtDuration(demand.designDuration),
    // ── 施工环节 ─────────────────────────────────────
    '施工单位':     typeof demand.assignedConstructionUnit === 'object' ? (demand.assignedConstructionUnit?.name || '-') : '-',
    '施工指派时间': fmtDate(demand.constructionAssignTime),
    '覆盖点名称':   demand.coverageName || '-',
    '施工备注':     demand.constructionRemark || '-',
    '施工历时':     fmtDuration(demand.constructionDuration),
    // ── 监理验收 ─────────────────────────────────────
    '监理单位':     typeof demand.assignedSupervisor === 'object' ? (demand.assignedSupervisor?.name || '-') : '-',
    '监理验收时间': fmtDate(demand.supervisorVerifyTime),
    '监理备注':     demand.supervisorRemark || '-',
    // ── 确认开通 ─────────────────────────────────────
    '确认人':       typeof demand.confirmBy === 'object' ? (demand.confirmBy?.name || '-') : '-',
    '确认时间':     fmtDate(demand.confirmTime),
    // ── 驳回信息 ─────────────────────────────────────
    '驳回次数':     demand.rejectCount ?? 0,
    '驳回原因':     demand.rejectionReason || '-',
    // ── 历时统计 ─────────────────────────────────────
    '总历时':       fmtDuration(demand.totalDuration),
    '完成时间':     fmtDate(demand.completedTime),
    // ── 操作日志 ─────────────────────────────────────
    '操作日志':     logsText || '-'
  };

  // 数字类型字段：有值才写，避免传字符串 '-' 被飞书 API 拒绝
  if (demand.reservedCustomers != null) fields['预约客户数'] = demand.reservedCustomers;
  if (demand.dpBoxCount != null)        fields['DP箱数量']   = demand.dpBoxCount;
  if (demand.latitude != null)          fields['纬度']        = demand.latitude;
  if (demand.longitude != null)         fields['经度']        = demand.longitude;

  // 资产状态（单选：已生效/待生效/未生效），有值才写
  if (demand.assetStatus) fields['资产状态'] = demand.assetStatus;

  // 最终状态（单选：已开通/已驳回），只在终态才写，过程中不写
  if (demand.status === '已开通' || demand.status === '已驳回') {
    fields['最终状态'] = demand.status;
  }

  // 附件字段：上传本地文件到飞书 Drive，写入 file_token 数组
  // 飞书多维表格中对应列需手动设置为"附件"类型
  if (appToken) {
    const [photosTokens, resourcePhotosTokens, designFilesTokens, constructionPhotosTokens, supervisorPhotosTokens] =
      await Promise.all([
        uploadAttachments(demand.photos, appToken),
        uploadAttachments(demand.resourcePhotos, appToken),
        uploadAttachments(demand.designFiles, appToken),
        uploadAttachments(demand.constructionPhotos, appToken),
        uploadAttachments(demand.supervisorPhotos, appToken),
      ]);
    if (photosTokens.length)             fields['现场照片']     = photosTokens;
    if (resourcePhotosTokens.length)     fields['资源照片']     = resourcePhotosTokens;
    if (designFilesTokens.length)        fields['设计文件']     = designFilesTokens;
    if (constructionPhotosTokens.length) fields['施工照片']     = constructionPhotosTokens;
    if (supervisorPhotosTokens.length)   fields['监理验收照片'] = supervisorPhotosTokens;
  }

  return fields;
}

/**
 * 同步工单到飞书多维表格（Upsert）
 * @param {Object} demand - 已 populate 的 demand 对象
 */
async function syncDemandToBitable(demand) {
  const appToken = process.env.FEISHU_BITABLE_APP_TOKEN;
  const tableId = process.env.FEISHU_BITABLE_TABLE_ID;

  if (!appToken || !tableId) {
    logger.warn('飞书多维表格未配置（FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID），跳过同步');
    return;
  }

  try {
    const token = await getTenantAccessToken();
    const fields = await buildFields(demand, appToken);
    const existingRecordId = await findRecordByDemandNo(token, appToken, tableId, demand.demandNo);

    if (existingRecordId) {
      await axios.put(
        `${BITABLE_BASE_URL}/apps/${appToken}/tables/${tableId}/records/${existingRecordId}`,
        { fields },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info('飞书多维表格记录已更新', { demandNo: demand.demandNo, recordId: existingRecordId });
    } else {
      await axios.post(
        `${BITABLE_BASE_URL}/apps/${appToken}/tables/${tableId}/records`,
        { fields },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info('飞书多维表格记录已新增', { demandNo: demand.demandNo });
    }
  } catch (err) {
    logger.error('飞书多维表格同步失败', {
      demandNo: demand.demandNo,
      error: err.message,
      feishuError: err.response?.data  // 飞书 API 返回的具体错误码和 msg
    });
  }
}

const POPULATE_FIELDS = [
  { path: 'createdBy',                select: 'name' },
  { path: 'assignedDesignUnit',       select: 'name' },
  { path: 'assignedConstructionUnit', select: 'name' },
  { path: 'assignedSupervisor',       select: 'name' },
  { path: 'confirmBy',                select: 'name' },
  { path: 'rejectedBy',               select: 'name' },
  { path: 'crossAreaReviewerId',      select: 'name' }
];

/**
 * populate 后同步到飞书多维表格（各路由统一调用此方法）
 * @param {Document} demand - Mongoose demand 文档（可未 populate）
 */
async function syncDemandWithPopulate(demand) {
  const populated = await demand.populate(POPULATE_FIELDS);
  return syncDemandToBitable(populated);
}

module.exports = { syncDemandToBitable, syncDemandWithPopulate };
