// 全局App，管理用户信息、token、角色
App({
  globalData: {
    userInfo: null,      // {phone, name, role, area, gridName, feishuId}
    currentRole: null,   // 当前选择的角色
    token: null,
    serverUrl: 'http://localhost:3000',  // 发布前替换为已备案 HTTPS 后端域名
    pendingPasswordChange: null  // 首次登录标记（跳转 profile 设置密码用）
  },

  onLaunch() {
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
