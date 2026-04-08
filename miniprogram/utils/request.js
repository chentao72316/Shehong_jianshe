const app = getApp();
const { processAndUpload, autoRetryDrafts, retryDraftUploads } = require('./image-helper');
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

function request(options) {
  const app = getApp();
  const token = app.globalData.token;
  debugLog('=== request ===');
  debugLog('URL:', app.globalData.serverUrl + options.url);
  debugLog('Token存在:', !!token);
  debugLog('Method:', options.method);
  debugLog('Data:', JSON.stringify(options.data || {}).slice(0, 100) + '...');
  return new Promise((resolve, reject) => {
    wx.request({
      url: app.globalData.serverUrl + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success(res) {
        debugLog('响应statusCode:', res.statusCode);
        debugLog('响应data:', JSON.stringify(res.data || {}).slice(0, 500));
        if (res.statusCode === 200) {
          if (res.data.code === 0) {
            resolve(res.data);
          } else if (res.data.code === 401) {
            wx.removeStorageSync('token');
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('currentRole');
            wx.reLaunch({ url: '/pages/login/login' });
            reject(new Error('登录已过期'));
          } else {
            reject(new Error(res.data.message || '请求失败'));
          }
        } else if (res.statusCode === 403) {
          reject(new Error(res.data?.message || '无权限操作'));
        } else if (res.statusCode === 423) {
          reject(new Error(res.data?.message || '账号已被锁定'));
        } else if (res.statusCode === 429) {
          reject(new Error(res.data?.message || '登录尝试过于频繁'));
        } else if (res.statusCode === 400 || res.statusCode === 404 || res.statusCode === 409 || res.statusCode === 500) {
          const errMsg = res.data?.message || `服务器错误(${res.statusCode})`;
          reject(new Error(errMsg));
        } else {
          reject(new Error('网络错误'));
        }
      },
      fail(err) {
        debugLog('请求fail:', err);
        reject(new Error('网络连接失败'));
      }
    });
  });
}

// 上传图片到服务器
function uploadFile(filePath, fileType = 'image') {
  return new Promise((resolve, reject) => {
    const token = app.globalData.token;
    debugLog('上传文件，token存在:', !!token);
    wx.uploadFile({
      url: app.globalData.serverUrl + `/api/upload/${fileType}`,
      filePath,
      name: 'file',
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success(res) {
        debugLog('上传响应:', res.data);
        let data;
        try {
          data = JSON.parse(res.data);
        } catch {
          reject(new Error('上传响应解析失败'));
          return;
        }
        if (data.code === 0) resolve(data);
        else reject(new Error(data.message));
      },
      fail: reject
    });
  });
}

/**
 * 带压缩和重试的上传函数
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型
 * @returns {Promise}
 */
function uploadFileWithRetry(filePath, fileType = 'image') {
  return processAndUpload(filePath, uploadFile, fileType);
}

module.exports = { request, uploadFile, uploadFileWithRetry, retryDraftUploads };
