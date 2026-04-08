const app = getApp();

// 快捷提问预设列表（可按实际需要调整）
const QUICK_QUESTIONS = [
  '太和东区域联系方式',
  '金华服务中心联系方式',
  '网格经理联系电话',
  '施工单位联系方式',
  '网络支撑经理电话',
  '装维电话查询',
];

Page({
  data: {
    messages: [],       // { id, role: 'user'|'assistant', content, loading }
    inputText: '',
    scrollTarget: '',
    showWelcome: true,
    quickQuestions: QUICK_QUESTIONS,
    safeBottom: 0,
  },

  onLoad() {
    // 获取底部安全区高度
    try {
      const info = wx.getSystemInfoSync();
      this.setData({ safeBottom: info.safeArea ? (info.screenHeight - info.safeArea.bottom) : 0 });
    } catch (e) {}
  },

  // ── 快捷标签点击 ─────────────────────────
  onQuickTap(e) {
    const text = e.currentTarget.dataset.text;
    this._sendMessage(text);
  },

  // ── 输入框内容同步 ───────────────────────
  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  // ── 发送按钮 / 键盘 confirm ──────────────
  onSend() {
    const text = (this.data.inputText || '').trim();
    if (!text) return;
    this.setData({ inputText: '' });
    this._sendMessage(text);
  },

  // ── 新对话 ───────────────────────────────
  onNewChat() {
    wx.removeStorageSync('ask_chat_id');
    this.setData({
      messages: [],
      showWelcome: true,
      inputText: '',
    });
  },

  // ── 核心：发送消息并调用 FastGPT ─────────
  async _sendMessage(text) {
    const messages = this.data.messages;

    // 1. 追加用户气泡
    const userId = `u_${Date.now()}`;
    messages.push({ id: userId, role: 'user', content: text });

    // 2. 追加 loading AI 气泡
    const aiId = `a_${Date.now()}`;
    messages.push({ id: aiId, role: 'assistant', content: '', loading: true });

    this.setData({ messages: [...messages], showWelcome: false });
    this._scrollBottom(aiId);

    // 3. 调用 FastGPT
    try {
      const reply = await this._callFastGPT(text);

      // 4. 用真实回复替换 loading 气泡
      const idx = this.data.messages.findIndex(m => m.id === aiId);
      if (idx !== -1) {
        const updated = [...this.data.messages];
        updated[idx] = { id: aiId, role: 'assistant', content: reply, loading: false };
        this.setData({ messages: updated });
        this._scrollBottom(aiId);
      }
    } catch (err) {
      console.error('[问问] FastGPT 调用失败:', err);
      const idx = this.data.messages.findIndex(m => m.id === aiId);
      if (idx !== -1) {
        const updated = [...this.data.messages];
        updated[idx] = {
          id: aiId,
          role: 'assistant',
          content: '抱歉，查询失败，请稍后重试。\n（' + (err.message || '网络错误') + '）',
          loading: false
        };
        this.setData({ messages: updated });
        this._scrollBottom(aiId);
      }
    }
  },

  // ── 通过后端代理调用 FastGPT API，避免 API Key 暴露在小程序端 ───────
  _callFastGPT(userText) {
    return new Promise((resolve, reject) => {
      // 获取或创建 chatId（同 session 复用，支持多轮上下文）
      let chatId = wx.getStorageSync('ask_chat_id');
      if (!chatId) {
        const openid = wx.getStorageSync('openid') || 'anon';
        chatId = `wx_${openid}_${Date.now()}`;
        wx.setStorageSync('ask_chat_id', chatId);
      }

      wx.request({
        url: app.globalData.serverUrl + '/api/ask/chat',
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': app.globalData.token ? `Bearer ${app.globalData.token}` : '',
        },
        data: {
          chatId,
          message: userText,
        },
        success(res) {
          if (res.statusCode === 200) {
            try {
              const content = res.data?.data?.reply;
              if (content) {
                resolve(content);
              } else {
                reject(new Error('回复格式异常'));
              }
            } catch (e) {
              reject(new Error('解析回复失败'));
            }
          } else {
            reject(new Error(`请求失败(${res.statusCode})`));
          }
        },
        fail(err) {
          reject(new Error(err.errMsg || '网络请求失败'));
        }
      });
    });
  },

  // ── 滚动到底部 ────────────────────────────
  _scrollBottom(targetId) {
    this.setData({ scrollTarget: '' });
    setTimeout(() => {
      this.setData({ scrollTarget: 'msg-bottom' });
    }, 50);
  }
});
