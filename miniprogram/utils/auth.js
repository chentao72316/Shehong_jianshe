const { phonePasswordLogin, wxBind, bindPhone, changePassword } = require('./api');
const { request } = require('./request');

// 验证 token 是否有效
async function checkAuth() {
  const app = getApp();
  if (!app.globalData.token) return false;
  try {
    await request({ url: '/api/user/role', method: 'GET' });
    return true;
  } catch {
    return false;
  }
}

// 退出登录
function logout() {
  const app = getApp();
  app.globalData.token = null;
  app.globalData.userInfo = null;
  app.globalData.currentRole = null;
  // 只清除登录相关 key，保留离线草稿等用户数据
  wx.removeStorageSync('token');
  wx.removeStorageSync('userInfo');
  wx.removeStorageSync('currentRole');
  wx.reLaunch({ url: '/pages/login/login' });
}

// 修改密码
async function updatePassword(oldPassword, newPassword) {
  return changePassword(oldPassword, newPassword);
}

module.exports = { checkAuth, logout, updatePassword };
