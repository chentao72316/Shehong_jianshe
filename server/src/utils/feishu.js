const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const { logger } = require('./logger');

// tenant_access_token 内存缓存，有效期2小时，提前5分钟刷新
let tokenCache = { value: null, expiresAt: 0 };

/**
 * 获取 tenant_access_token
 * 自动缓存，过期前5分钟自动刷新
 */
async function getTenantAccessToken() {
  const now = Date.now();
  if (tokenCache.value && now < tokenCache.expiresAt) {
    return tokenCache.value;
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('FEISHU_APP_ID 或 FEISHU_APP_SECRET 未配置');
  }

  const res = await axios.post(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    { app_id: appId, app_secret: appSecret }
  );

  if (res.data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${res.data.msg}`);
  }

  // expire 单位为秒，提前300秒（5分钟）刷新
  tokenCache = {
    value: res.data.tenant_access_token,
    expiresAt: now + (res.data.expire - 300) * 1000
  };

  logger.info('tenant_access_token 已刷新');
  return tokenCache.value;
}

/**
 * 发送飞书 Webhook 机器人消息（无需 token，不支持 @人）
 * @param {string} webhookUrl - 飞书 webhook 地址
 * @param {string} title - 消息标题
 * @param {string} content - 消息正文（支持 lark_md）
 * @param {string} [template] - 卡片颜色 red/orange/blue/green，默认 red
 */
async function sendFeishuMessage(webhookUrl, title, content, template = 'red') {
  if (!webhookUrl) {
    logger.warn('飞书Webhook未配置，跳过消息发送');
    return;
  }
  try {
    await axios.post(webhookUrl, {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: title },
          template
        },
        elements: [{
          tag: 'div',
          text: { tag: 'lark_md', content }
        }]
      }
    });
    logger.info('飞书消息发送成功', { title });
  } catch (err) {
    logger.error('飞书消息发送失败', { title, error: err.message });
  }
}

/**
 * 通过开放平台 API 发送群消息（支持 @人，需要 FEISHU_APP_ID/APP_SECRET）
 * @param {string} chatId - 群 chat_id
 * @param {string} title - 消息标题
 * @param {string} content - 消息正文（支持 lark_md）
 * @param {string[]} [mentionOpenIds] - 需要 @的用户 open_id 列表
 * @param {string} [template] - 卡片颜色，默认 blue
 */
async function sendGroupMessage(chatId, title, content, mentionOpenIds = [], template = 'blue') {
  if (!chatId) {
    logger.warn('FEISHU_CHAT_ID 未配置，跳过群消息发送');
    return;
  }

  try {
    const token = await getTenantAccessToken();

    // 在正文末尾追加 @mention 标签
    const mentionText = mentionOpenIds.map(id => `<at user_id="${id}"></at>`).join(' ');
    const fullContent = mentionOpenIds.length ? `${content}\n${mentionText}` : content;

    await axios.post(
      'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id',
      {
        receive_id: chatId,
        msg_type: 'interactive',
        content: JSON.stringify({
          header: {
            title: { tag: 'plain_text', content: title },
            template
          },
          elements: [{
            tag: 'div',
            text: { tag: 'lark_md', content: fullContent }
          }]
        })
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logger.info('飞书群消息发送成功', { title, chatId });
  } catch (err) {
    logger.error('飞书群消息发送失败', { title, error: err.message });
  }
}

/**
 * 发送超时督办飞书提醒
 * @param {Object} demand - 需求数据
 * @param {Object} targetUser - 被督办的用户（含 feishuId 字段）
 */
async function sendTimeoutRemind(demand, targetUser) {
  const content = [
    `**需求编号**: ${demand.demandNo}`,
    `**需求类型**: ${demand.type}`,
    `**区域**: ${demand.acceptArea}`,
    `**当前状态**: ${demand.status}`,
    `**请及时处理，避免进一步超时！**`
  ].join('\n');

  const chatId = process.env.FEISHU_CHAT_ID;
  const mentionIds = targetUser?.feishuId ? [targetUser.feishuId] : [];

  // 优先用开放 API（支持 @人），降级用 Webhook
  if (chatId && process.env.FEISHU_APP_ID) {
    await sendGroupMessage(chatId, '建设需求超时督办提醒', content, mentionIds, 'red');
  } else {
    await sendFeishuMessage(process.env.FEISHU_WEBHOOK_URL, '建设需求超时督办提醒', content, 'red');
  }
}

/**
 * 上传本地文件到飞书多维表格附件存储区，返回 file_token
 * 用于将工单图片/文件写入 Bitable 附件字段
 * @param {string} localFilePath - 服务器本地文件绝对路径
 * @param {string} fileName - 文件展示名称
 * @param {string} appToken - 多维表格 app_token（作为 parent_node）
 * @returns {Promise<string|null>} file_token，失败返回 null
 */
async function uploadFileToDrive(localFilePath, fileName, appToken) {
  if (!fs.existsSync(localFilePath)) {
    logger.warn('飞书上传：本地文件不存在', { localFilePath });
    return null;
  }
  try {
    const token = await getTenantAccessToken();
    const stats = fs.statSync(localFilePath);
    const form = new FormData();
    form.append('file_name', fileName);
    form.append('parent_type', 'bitable_file');
    form.append('parent_node', appToken);
    form.append('size', String(stats.size));
    form.append('file', fs.createReadStream(localFilePath), { filename: fileName });

    const res = await axios.post(
      'https://open.feishu.cn/open-apis/drive/v1/medias/upload_all',
      form,
      { headers: { ...form.getHeaders(), Authorization: `Bearer ${token}` } }
    );
    if (res.data.code !== 0) {
      logger.warn('飞书文件上传失败', { fileName, code: res.data.code, msg: res.data.msg });
      return null;
    }
    return res.data.data.file_token;
  } catch (err) {
    logger.warn('飞书文件上传异常', { fileName, error: err.message });
    return null;
  }
}

module.exports = { getTenantAccessToken, sendFeishuMessage, sendGroupMessage, sendTimeoutRemind, uploadFileToDrive };
