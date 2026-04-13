// 全局App，管理用户信息、token、角色
App({
  globalData: {
    userInfo: null,      // {phone, name, role, area, gridName, feishuId}
    currentRole: null,   // 当前选择的角色
    token: null,
    serverUrl: '',
    apiHosts: {
      develop: 'http://localhost:3000',
      trial: 'https://api.sndqt.cn',
      release: 'https://api.sndqt.cn'
    },
    pendingPasswordChange: null  // 首次登录标记（跳转 profile 设置密码用）
  },

  onLaunch() {
    const accountInfo = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const envVersion = accountInfo?.miniProgram?.envVersion || 'develop';
    this.globalData.serverUrl = this.globalData.apiHosts[envVersion] || this.globalData.apiHosts.release;

    // 检查本地缓存的登录状态
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const currentRole = wx.getStorageSync('currentRole');
    if (token && userInfo) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.currentRole = currentRole;
    }
  }
});
