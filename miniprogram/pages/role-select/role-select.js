const { ROLES } = require('../../utils/constants');
const { getUserRole } = require('../../utils/api');

Page({
  data: {
    roles: [],
    userInfo: null
  },

  async onLoad() {
    const app = getApp();
    this.setData({ userInfo: app.globalData.userInfo });
    try {
      const res = await getUserRole();
      // 后端返回该用户拥有的角色列表
      const roleList = res.data.roles.map(role => ({
        key: role,
        label: ROLES[role] || role
      }));
      this.setData({ roles: roleList });
    } catch (err) {
      // 错误已在request.js统一处理
    }
  },

  onSelectRole(e) {
    const { role } = e.currentTarget.dataset;
    const app = getApp();
    app.globalData.currentRole = role;
    wx.setStorageSync('currentRole', role);
    wx.switchTab({ url: '/pages/home/home' });
  }
});
