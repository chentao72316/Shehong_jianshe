const { phonePasswordLogin, wxBind, bindPhone } = require('../../utils/api');

Page({
  data: {
    loading: false,
    bindLoading: false,
    currentTab: 'wx',     // 'wx' | 'phone'
    phone: '',
    password: '',
    showPassword: false,
    // 绑定弹窗
    showBindModal: false,
    bindToken: '',
    bindPhone: '',
    bindPassword: '',
    showBindPassword: false
  },

  /**
   * 切换登录 Tab
   */
  switchTab(e) {
    this.setData({ currentTab: e.currentTarget.dataset.tab });
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  /**
   * 密码输入
   */
  onPasswordInput(e) {
    this.setData({ password: e.detail.value });
  },

  /**
   * 切换密码可见状态
   */
  togglePasswordVisible() {
    this.setData({ showPassword: !this.data.showPassword });
  },

  /**
   * 手机号 + 密码登录
   */
  async onPhoneLogin() {
    if (this.data.loading) return;
    const { phone, password } = this.data;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });

    try {
      const res = await phonePasswordLogin(phone, password);
      this.handleLoginSuccess(res);
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: err.message || '登录失败，请检查手机号和密码',
        icon: 'none',
        duration: 2500
      });
    }
  },

  /**
   * 微信一键登录
   */
  async onWxLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    wx.showLoading({ title: '登录中...' });

    try {
      const loginRes = await new Promise((resolve, reject) =>
        wx.login({ success: resolve, fail: reject })
      );
      const res = await wxBind(loginRes.code);

      if (res.needBind) {
        // 需要绑定手机号
        wx.hideLoading();
        this.setData({
          loading: false,
          showBindModal: true,
          bindToken: res.bindToken
        });
        return;
      }

      this.handleLoginSuccess(res);
    } catch (err) {
      wx.hideLoading();
      this.setData({ loading: false });
      wx.showToast({
        title: err.message || '微信登录失败，请重试',
        icon: 'none',
        duration: 2500
      });
    }
  },

  /**
   * 绑定弹窗 - 手机号输入
   */
  onBindPhoneInput(e) {
    this.setData({ bindPhone: e.detail.value });
  },

  /**
   * 绑定弹窗 - 密码输入
   */
  onBindPasswordInput(e) {
    this.setData({ bindPassword: e.detail.value });
  },

  /**
   * 切换绑定弹窗密码可见状态
   */
  toggleBindPasswordVisible() {
    this.setData({ showBindPassword: !this.data.showBindPassword });
  },

  /**
   * 取消绑定
   */
  onCancelBind() {
    this.setData({
      showBindModal: false,
      bindToken: '',
      bindPhone: '',
      bindPassword: '',
      showBindPassword: false
    });
  },

  /**
   * 确认绑定手机号
   */
  async onConfirmBind() {
    if (this.data.bindLoading) return;
    const { bindToken, bindPhone, bindPassword } = this.data;

    if (!bindPhone || !/^1[3-9]\d{9}$/.test(bindPhone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    if (!bindPassword) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      return;
    }

    this.setData({ bindLoading: true });

    try {
      const res = await bindPhone(bindToken, bindPhone, bindPassword);
      this.setData({
        showBindModal: false,
        bindToken: '',
        bindPhone: '',
        bindPassword: '',
        showBindPassword: false
      });
      this.handleLoginSuccess(res);
    } catch (err) {
      this.setData({ bindLoading: false });
      wx.showToast({
        title: err.message || '绑定失败，请检查手机号和密码',
        icon: 'none',
        duration: 2500
      });
    }
  },

  /**
   * 登录成功处理
   */
  handleLoginSuccess(res) {
    wx.hideLoading();
    this.setData({ loading: false });
    const app = getApp();
    const data = res.data || {};
    const token = data.token;
    const userInfo = data.userInfo || {};
    const roles = userInfo.roles || [];

    app.globalData.token = token;
    app.globalData.userInfo = userInfo;
    wx.setStorageSync('token', token);
    wx.setStorageSync('userInfo', userInfo);

    // 判断是否需要强制修改密码（首次登录）
    if (userInfo.passwordChanged === false) {
      // profile 是 tabbar 页面，用 switchTab 跳转，firstLogin 存 globalData
      app.globalData.pendingPasswordChange = true;
      wx.switchTab({ url: '/pages/profile/profile' });
      return;
    }

    // 根据角色数量决定跳转
    if (roles.length > 1) {
      wx.redirectTo({ url: '/pages/role-select/role-select' });
      return;
    }

    // 单角色或无角色，直接跳转首页
    const currentRole = roles.length === 1 ? roles[0] : '';
    app.globalData.currentRole = currentRole;
    wx.setStorageSync('currentRole', currentRole);
    wx.switchTab({ url: '/pages/home/home' });
  }
});
