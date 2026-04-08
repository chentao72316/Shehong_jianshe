const { logout, updatePassword } = require('../../utils/auth');
const { ROLES } = require('../../utils/constants');

Page({
  data: {
    userInfo: null,
    currentRoleLabel: '',
    currentRole: '',
    showPasswordModal: false,
    isFirstLogin: false,
    loading: false,
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  },

  onLoad(options) {
    const app = getApp();
    this.setData({
      userInfo: app.globalData.userInfo,
      currentRole: app.globalData.currentRole,
      currentRoleLabel: ROLES[app.globalData.currentRole] || app.globalData.currentRole
    });

    // 首次登录强制设置密码（URL参数方式，如 ?firstLogin=1）
    if (options.firstLogin === '1') {
      const userInfo = app.globalData.userInfo;
      if (userInfo && userInfo.passwordChanged === false) {
        this.setData({
          showPasswordModal: true,
          isFirstLogin: true
        });
      }
    }
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      if (tabBar.refreshTabs) tabBar.refreshTabs();
      if (tabBar.syncSelected) tabBar.syncSelected();
    }
    const app = getApp();
    this.setData({
      userInfo: app.globalData.userInfo,
      currentRole: app.globalData.currentRole,
      currentRoleLabel: ROLES[app.globalData.currentRole] || app.globalData.currentRole
    });

    // switchTab 跳转过来时，从 globalData 读取首次登录标记
    if (app.globalData.pendingPasswordChange) {
      app.globalData.pendingPasswordChange = false;
      const userInfo = app.globalData.userInfo;
      if (userInfo && userInfo.passwordChanged === false) {
        this.setData({
          showPasswordModal: true,
          isFirstLogin: true
        });
      }
    }
  },

  onSwitchRole() {
    wx.navigateTo({ url: '/pages/role-select/role-select' });
  },

  onNavTo(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) return;
    wx.navigateTo({ url });
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确认退出登录？',
      success(res) {
        if (res.confirm) {
          logout();
        }
      }
    });
  },

  // ─── 密码修改 ───

  onChangePassword() {
    this.setData({
      showPasswordModal: true,
      isFirstLogin: false,
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  },

  onOldPasswordInput(e) {
    this.setData({ oldPassword: e.detail.value });
  },

  onNewPasswordInput(e) {
    this.setData({ newPassword: e.detail.value });
  },

  onConfirmPasswordInput(e) {
    this.setData({ confirmPassword: e.detail.value });
  },

  onCancelPassword() {
    // 首次登录不允许取消
    if (this.data.isFirstLogin) {
      wx.showToast({ title: '请先设置密码', icon: 'none' });
      return;
    }
    this.setData({ showPasswordModal: false });
  },

  async onConfirmPassword() {
    if (this.data.loading) return;
    const { isFirstLogin, oldPassword, newPassword, confirmPassword } = this.data;

    // 密码确认
    if (newPassword !== confirmPassword) {
      wx.showToast({ title: '两次输入的密码不一致', icon: 'none' });
      return;
    }

    // 密码强度验证（8位以上，含大小写字母和数字）
    if (newPassword.length < 8) {
      wx.showToast({ title: '密码长度至少8位', icon: 'none' });
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      wx.showToast({ title: '密码需包含大写字母', icon: 'none' });
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      wx.showToast({ title: '密码需包含小写字母', icon: 'none' });
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      wx.showToast({ title: '密码需包含数字', icon: 'none' });
      return;
    }

    // 首次登录：当前密码(第1个)=原密码，设置密码(第2个)=新密码
    const params = isFirstLogin
      ? { oldPassword: oldPassword, newPassword: newPassword }
      : { oldPassword, newPassword };

    this.setData({ loading: true });
    try {
      await updatePassword(params.oldPassword, params.newPassword);

      // 更新本地存储中的 passwordChanged 标志
      const app = getApp();
      if (app.globalData.userInfo) {
        app.globalData.userInfo.passwordChanged = true;
        wx.setStorageSync('userInfo', app.globalData.userInfo);
      }

      wx.showToast({
        title: isFirstLogin ? '密码设置成功' : '密码修改成功',
        icon: 'success'
      });
      this.setData({ showPasswordModal: false, loading: false });

      // 如果是首次登录，设置密码成功后跳转到角色选择
      if (isFirstLogin) {
        const userInfo = app.globalData.userInfo;
        if (userInfo.roles && userInfo.roles.length > 1) {
          wx.redirectTo({ url: '/pages/role-select/role-select' });
        } else {
          app.globalData.currentRole = userInfo.roles && userInfo.roles[0];
          wx.setStorageSync('currentRole', userInfo.roles && userInfo.roles[0]);
          wx.switchTab({ url: '/pages/home/home' });
        }
      }
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  }
});
