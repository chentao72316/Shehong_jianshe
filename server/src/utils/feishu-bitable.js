/**
 * feishu-bitable.js
 * 椋炰功澶氱淮琛ㄦ牸鍚屾宸ュ叿
 * 灏嗗伐鍗曞畬鏁翠俊鎭啓鍏ラ涔﹀缁磋〃鏍硷紙Upsert锛氫互 demandNo 涓哄敮涓€閿級
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { getTenantAccessToken, uploadFileToDrive } = require('./feishu');
const { logger } = require('./logger');
const { fmtDate, fmtDuration } = require('./format');
const { inferCompletionMode, getCompletionModeLabel } = require('./completion-mode');
const { recalculateDemandDurations } = require('./demand-duration');

const BITABLE_BASE_URL = 'https://open.feishu.cn/open-apis/bitable/v1';

const FEISHU_FIELD_TYPE_HINTS = {
  '工单编号': '单行文本',
  '所属区县': '单行文本',
  '受理区域': '单行文本',
  '网格': '单行文本',
  '服务中心': '单行文本',
  '网络支撑中心': '单行文本',
  '申请人姓名': '单行文本',
  '申请人电话': '单行文本',
  '提交人': '单行文本',
  '提交人手机号': '单行文本',
  '详细地址': '多行文本',
  '需求备注': '多行文本',
  '创建时间': '日期时间',
  '业务类型': '单选',
  '需求类型': '单选',
  '紧急程度': '单选',
  '设计单位': '单行文本',
  '设计指派时间': '日期时间',
  '是否有资源': '单选',
  '资源名称': '单行文本',
  '设计备注': '多行文本',
  '设计历时': '单行文本',
  '施工单位': '单行文本',
  '施工指派时间': '日期时间',
  '覆盖点名称': '单行文本',
  '纬度': '数字',
  '经度': '数字',
  '完工纬度': '数字',
  '完工经度': '数字',
  '完工位置详细描述': '多行文本',
  '施工备注': '多行文本',
  '施工历时': '单行文本',
  '监理单位': '单行文本',
  '监理验收时间': '日期时间',
  '监理备注': '多行文本',
  '确认人': '单行文本',
  '确认时间': '日期时间',
  '确认驳回原因': '多行文本',
  '开通方式': '单选',
  '驳回类型': '单选',
  '驳回次数': '数字',
  '驳回时间': '日期时间',
  '驳回人': '单行文本',
  '驳回已确认': '复选框',
  '驳回原因': '多行文本',
  '跨区审核人': '单行文本',
  '跨区审核意见': '多行文本',
  '总历时': '单行文本',
  '完成时间': '日期时间',
  '最终状态': '单选',
  '操作日志': '多行文本',
  '预约客户数': '数字',
  'DP箱数量': '数字',
  '现场照片': '附件',
  '资源照片': '附件',
  '设计文件': '附件',
  '施工照片': '附件',
  '监理验收照片': '附件'
};

const FEISHU_FIELD_OPTION_HINTS = {
  '业务类型': ['家宽', '专线', '无线', '其他'],
  '需求类型': ['新建', '扩容', '改造', '应急'],
  '紧急程度': ['普通', '紧急', '特急'],
  '是否有资源': ['是（300m内）', '否', '-'],
  '资产状态': ['已生效', '待生效', '未生效'],
  '开通方式': ['已有资源开通', '施工建设开通', '-'],
  '驳回类型': ['有资源', '其他'],
  '最终状态': ['已开通', '已驳回']
};

// 涓婁紶鐩綍锛歴erver/uploads锛堢浉瀵逛簬 server/src/utils锛屽線涓婁袱绾э級
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// 内存缓存：localFilePath -> file_token，避免同一会话内重复上传
const fileTokenCache = new Map();

function summarizeFields(fields) {
  const entries = Object.entries(fields || {}).filter(([, value]) => value !== undefined);
  return {
    fieldCount: entries.length,
    fieldKeys: entries.map(([key]) => key),
    attachmentFields: entries
      .filter(([, value]) => Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].file_token)
      .map(([key, value]) => ({ key, count: value.length }))
  };
}

function extractRecordIdFromResponse(responseData) {
  return (
    responseData?.data?.record?.record_id ||
    responseData?.data?.record_id ||
    responseData?.record?.record_id ||
    responseData?.record_id ||
    null
  );
}

function summarizeResponseShape(responseData) {
  return {
    rootKeys: Object.keys(responseData || {}),
    dataKeys: Object.keys(responseData?.data || {}),
    hasRecordObject: !!responseData?.data?.record || !!responseData?.record
  };
}

function toFeishuTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function assertFeishuApiSuccess(responseData, action) {
  if (responseData?.code === 0) {
    return;
  }

  const error = new Error(`飞书多维表格${action}失败: ${responseData?.msg || '未知错误'}`);
  error.feishuResponse = responseData;
  throw error;
}

function parseFieldNameFromFeishuMessage(message) {
  if (!message) return null;
  const match = message.match(/fields\.([^'.]+)'/);
  return match ? match[1] : null;
}

function buildFeishuErrorHint(feishuResponse) {
  const code = feishuResponse?.code;
  const message = feishuResponse?.error?.message || '';
  const fieldName = parseFieldNameFromFeishuMessage(message);
  const expectedType = fieldName ? FEISHU_FIELD_TYPE_HINTS[fieldName] || null : null;

  if (code === 1254045 && fieldName) {
    return {
      issueType: 'missing_field',
      fieldName,
      expectedType,
      suggestion: expectedType
        ? `请在飞书多维表格中新增字段“${fieldName}”，字段类型为“${expectedType}”`
        : `请检查飞书多维表格中是否缺少字段“${fieldName}”`
    };
  }

  if (code === 1254064 && fieldName) {
    return {
      issueType: 'field_type_mismatch',
      fieldName,
      expectedType,
      suggestion: expectedType
        ? `请检查飞书字段“${fieldName}”的类型是否为“${expectedType}”，并确认选项/格式与代码写入值一致`
        : `请检查飞书字段“${fieldName}”的类型或格式是否与代码写入值一致`
    };
  }

  return null;
}

/**
 * 鏌ヨ澶氱淮琛ㄦ牸涓槸鍚﹀凡鏈夎宸ュ崟璁板綍锛岃繑鍥?record_id 鎴?null
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
    assertFeishuApiSuccess(res.data, '查询记录');
    const items = res.data?.data?.items;
    if (items && items.length > 0) {
      return items[0].record_id;
    }
    return null;
  } catch (err) {
    logger.warn('飞书多维表格查询现有记录失败，将按新增流程继续', {
      demandNo,
      appToken,
      tableId,
      error: err.message,
      responseStatus: err.response?.status,
      feishuError: err.response?.data
    });
    return null;
  }
}

/**
 * 灏?URL 鏁扮粍涓婁紶鑷抽涔?Drive锛岃繑鍥?[{ file_token }] 鏁扮粍
 * - 鐩稿璺緞锛?uploads/...锛変粠鏈湴璇诲彇鏂囦欢涓婁紶
 * - 澶栭儴 URL锛坔ttp://...锛夋棤娉曟湰鍦拌鍙栵紝璺宠繃
 * - 涓婁紶澶辫触鏃堕潤榛樿烦杩囷紝涓嶄腑鏂暣浣撳悓姝? * @param {string[]} urls
 * @param {string} appToken - Bitable app_token
 * @returns {Promise<Array<{file_token: string}>>}
 */
async function uploadAttachments(urls, appToken) {
  if (!urls || urls.length === 0) return [];
  const results = [];
  for (const url of urls) {
    if (!url) continue;
    let pathname = url;
    if (url.startsWith('http')) {
      try {
        pathname = new URL(url).pathname;
      } catch {
        continue;
      }
    }
    if (!pathname.startsWith('/uploads/')) {
      logger.warn('椋炰功闄勪欢璺宠繃锛氶潪鏈湴涓婁紶璺緞', { url });
      continue;
    }
    const relativePath = decodeURIComponent(pathname.replace(/^\/uploads\//, ''));
    const localPath = path.join(UPLOADS_DIR, relativePath);
    if (!fs.existsSync(localPath)) {
      logger.warn('椋炰功闄勪欢璺宠繃锛氭湰鍦版枃浠朵笉瀛樺湪', { url, localPath });
      continue;
    }
    // 鍐呭瓨缂撳瓨鍛戒腑
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
 * 鏋勫缓椋炰功澶氱淮琛ㄦ牸瀛楁瀵硅薄锛堜弗鏍煎搴旇〃鏍煎垪鍚嶅拰绫诲瀷锛? * 琛ㄦ牸瀛楁绫诲瀷鍙傝€冿細澶氱淮琛ㄦ牸鏂板缓瀛楁鍙婄被鍨?md
 * 娉ㄦ剰锛? *   - 鏁板瓧绫诲瀷瀛楁锛堥绾﹀鎴锋暟/DP绠辨暟閲?绾害/缁忓害/椹冲洖娆℃暟锛夋湁鍊兼墠鍐欙紝閬垮厤浼犲瓧绗︿覆瀵艰嚧 API 鎶ラ敊
 *   - 鍗曢€夌被鍨嬪瓧娈碉紙涓氬姟绫诲瀷/闇€姹傜被鍨?绱ф€ョ▼搴?璧勪骇鐘舵€?鏈€缁堢姸鎬侊級鍙紶琛ㄦ牸宸叉湁閫夐」鍊? *   - 鏈€缁堢姸鎬佸彧鍦ㄥ伐鍗曞埌杈剧粓鎬侊紙宸插紑閫?宸查┏鍥烇級鏃跺啓鍏ワ紝杩囩▼涓笉鍐? *   - 鐜板満鐓х墖/璧勬簮鐓х墖/璁捐鏂囦欢/鏂藉伐鐓х墖/鐩戠悊鐓х墖锛氫笂浼犲埌椋炰功 Drive 鍚庡啓闄勪欢瀛楁
 *     澶氱淮琛ㄦ牸涓繖5鍒楅渶鎵嬪姩璁剧疆涓?闄勪欢"绫诲瀷
 */
async function buildFields(demand, appToken) {
  recalculateDemandDurations(demand);
  const completionMode = inferCompletionMode(demand);
  const logsText = (demand.logs || [])
    .map(l => `[${fmtDate(l.createdAt)}] ${l.operatorName || ''}: ${l.content}`)
    .join('\n');

  const fields = {
    '工单编号': demand.demandNo || '-',
    '所属区县': demand.district || '-',
    '受理区域': demand.acceptArea || '-',
    '网格': demand.gridName || '-',
    '服务中心': demand.serviceCenter || '-',
    '网络支撑中心': demand.networkSupport || '-',
    '申请人姓名': demand.demandPersonName || '-',
    '申请人电话': demand.demandPersonPhone || '-',
    '提交人': typeof demand.createdBy === 'object' ? (demand.createdBy?.name || '-') : '-',
    '提交人手机号': demand.submitterPhone || '-',
    '详细地址': demand.locationDetail || '-',
    '需求备注': demand.remark || '-',
    '创建时间': toFeishuTimestamp(demand.createdAt),
    '业务类型': demand.businessType || null,
    '需求类型': demand.type || null,
    '紧急程度': demand.urgency || '普通',
    '设计单位': typeof demand.assignedDesignUnit === 'object' ? (demand.assignedDesignUnit?.name || '-') : '-',
    '设计指派时间': toFeishuTimestamp(demand.designAssignTime),
    '是否有资源': demand.hasResource == null ? '-' : (demand.hasResource ? '是（300m内）' : '否'),
    '资源名称': demand.resourceName || '-',
    '设计备注': demand.designRemark || '-',
    '设计历时': fmtDuration(demand.designDuration),
    '施工单位': typeof demand.assignedConstructionUnit === 'object' ? (demand.assignedConstructionUnit?.name || '-') : '-',
    '施工指派时间': toFeishuTimestamp(demand.constructionAssignTime),
    '覆盖点名称': demand.coverageName || '-',
    '完工纬度': demand.constructionLat ?? null,
    '完工经度': demand.constructionLng ?? null,
    '完工位置详细描述': demand.constructionLocationDetail || '-',
    '施工备注': demand.constructionRemark || '-',
    '施工历时': fmtDuration(demand.constructionDuration),
    '监理单位': typeof demand.assignedSupervisor === 'object' ? (demand.assignedSupervisor?.name || '-') : '-',
    '监理验收时间': toFeishuTimestamp(demand.supervisorVerifyTime),
    '监理备注': demand.supervisorRemark || '-',
    '确认人': typeof demand.confirmBy === 'object' ? (demand.confirmBy?.name || '-') : '-',
    '确认时间': toFeishuTimestamp(demand.confirmTime),
    '确认驳回原因': demand.confirmRejectReason || '-',
    '开通方式': getCompletionModeLabel(completionMode) || '-',
    '驳回类型': demand.rejectType || null,
    '驳回次数': demand.rejectCount ?? 0,
    '驳回时间': toFeishuTimestamp(demand.rejectionTime),
    '驳回人': typeof demand.rejectedBy === 'object' ? (demand.rejectedBy?.name || '-') : '-',
    '驳回已确认': !!demand.rejectionAcknowledged,
    '驳回原因': demand.rejectionReason || '-',
    '跨区审核人': typeof demand.crossAreaReviewerId === 'object' ? (demand.crossAreaReviewerId?.name || '-') : '-',
    '跨区审核意见': demand.crossAreaApproveNote || '-',
    '总历时': fmtDuration(demand.totalDuration),
    '完成时间': toFeishuTimestamp(demand.completedTime),
    '操作日志': logsText || '-'
  };

  if (demand.reservedCustomers != null) fields['预约客户数'] = demand.reservedCustomers;
  if (demand.dpBoxCount != null) fields['DP箱数量'] = demand.dpBoxCount;
  if (demand.latitude != null) fields['纬度'] = demand.latitude;
  if (demand.longitude != null) fields['经度'] = demand.longitude;
  if (fields['创建时间'] == null) delete fields['创建时间'];
  if (fields['设计指派时间'] == null) delete fields['设计指派时间'];
  if (fields['施工指派时间'] == null) delete fields['施工指派时间'];
  if (fields['监理验收时间'] == null) delete fields['监理验收时间'];
  if (fields['确认时间'] == null) delete fields['确认时间'];
  if (fields['驳回时间'] == null) delete fields['驳回时间'];
  if (fields['完成时间'] == null) delete fields['完成时间'];
  if (demand.constructionLat == null) delete fields['完工纬度'];
  if (demand.constructionLng == null) delete fields['完工经度'];
  if (!demand.rejectType) delete fields['驳回类型'];

  if (demand.assetStatus) fields['资产状态'] = demand.assetStatus;

  if (demand.status === '已开通' || demand.status === '已驳回') {
    fields['最终状态'] = demand.status;
  }

  if (appToken) {
    const [photosTokens, resourcePhotosTokens, designFilesTokens, constructionPhotosTokens, supervisorPhotosTokens] =
      await Promise.all([
        uploadAttachments(demand.photos, appToken),
        uploadAttachments(demand.resourcePhotos, appToken),
        uploadAttachments(demand.designFiles, appToken),
        uploadAttachments(demand.constructionPhotos, appToken),
        uploadAttachments(demand.supervisorPhotos, appToken),
      ]);
    if (photosTokens.length) fields['现场照片'] = photosTokens;
    if (resourcePhotosTokens.length) fields['资源照片'] = resourcePhotosTokens;
    if (designFilesTokens.length) fields['设计文件'] = designFilesTokens;
    if (constructionPhotosTokens.length) fields['施工照片'] = constructionPhotosTokens;
    if (supervisorPhotosTokens.length) fields['监理验收照片'] = supervisorPhotosTokens;
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
    const fieldSummary = summarizeFields(fields);
    const existingRecordId = await findRecordByDemandNo(token, appToken, tableId, demand.demandNo);

    if (existingRecordId) {
      const updateRes = await axios.put(
        `${BITABLE_BASE_URL}/apps/${appToken}/tables/${tableId}/records/${existingRecordId}`,
        { fields },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      assertFeishuApiSuccess(updateRes.data, '更新记录');
      logger.info('飞书多维表格记录已更新', {
        demandNo: demand.demandNo,
        appToken,
        tableId,
        recordId: existingRecordId,
        ...fieldSummary
      });
    } else {
      const createRes = await axios.post(
        `${BITABLE_BASE_URL}/apps/${appToken}/tables/${tableId}/records`,
        { fields },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      assertFeishuApiSuccess(createRes.data, '新增记录');
      const createdRecordId = extractRecordIdFromResponse(createRes.data);
      logger.info('飞书多维表格记录已新增', {
        demandNo: demand.demandNo,
        appToken,
        tableId,
        recordId: createdRecordId,
        responseShape: createdRecordId ? undefined : summarizeResponseShape(createRes.data),
        ...fieldSummary
      });
    }
  } catch (err) {
    const feishuError = err.response?.data || err.feishuResponse;
    const errorHint = buildFeishuErrorHint(feishuError);
    logger.error('飞书多维表格同步失败', {
      demandNo: demand.demandNo,
      appToken,
      tableId,
      error: err.message,
      responseStatus: err.response?.status,
      feishuError,
      errorHint
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
 * populate 鍚庡悓姝ュ埌椋炰功澶氱淮琛ㄦ牸锛堝悇璺敱缁熶竴璋冪敤姝ゆ柟娉曪級
 * @param {Document} demand - Mongoose demand 鏂囨。锛堝彲鏈?populate锛? */
async function syncDemandWithPopulate(demand) {
  const populated = await demand.populate(POPULATE_FIELDS);
  return syncDemandToBitable(populated);
}

module.exports = {
  syncDemandToBitable,
  syncDemandWithPopulate,
  FEISHU_FIELD_TYPE_HINTS,
  FEISHU_FIELD_OPTION_HINTS
};



