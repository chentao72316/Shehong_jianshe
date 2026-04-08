const express = require('express');
const axios = require('axios');
const Config = require('../models/config.model');
const { createError } = require('../middleware/error-handler');
const { logger } = require('../utils/logger');

const router = express.Router();

router.post('/ask/chat', async (req, res, next) => {
  try {
    const { chatId, message } = req.body;
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) throw createError(400, '请输入问题内容');
    if (text.length > 2000) throw createError(400, '问题内容不能超过2000字');

    const [hostCfg, keyCfg] = await Promise.all([
      Config.findOne({ key: 'FASTGPT_HOST' }).lean(),
      Config.findOne({ key: 'FASTGPT_API_KEY' }).lean()
    ]);

    const host = typeof hostCfg?.value === 'string' ? hostCfg.value.replace(/\/$/, '') : '';
    const apiKey = typeof keyCfg?.value === 'string' ? keyCfg.value : '';
    if (!host || !apiKey) throw createError(503, 'FastGPT 未配置，请联系管理员');

    const response = await axios.post(`${host}/v1/chat/completions`, {
      chatId: chatId || `user_${req.user._id}`,
      stream: false,
      detail: false,
      messages: [{ role: 'user', content: text }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 30000
    });

    const reply = response.data?.choices?.[0]?.message?.content;
    if (!reply) throw createError(502, 'FastGPT 回复格式异常');
    res.json({ code: 0, data: { reply } });
  } catch (err) {
    if (err.response) {
      logger.warn('FastGPT 调用失败', { status: err.response.status, message: err.message });
      return next(createError(502, 'FastGPT 服务调用失败'));
    }
    next(err);
  }
});

module.exports = router;
