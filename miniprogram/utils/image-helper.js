/**
 * 图片处理工具 - 压缩、离线缓存、自动重试
 */

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const COMPRESS_QUALITY = 80;
const SIZE_THRESHOLD = 2 * 1024 * 1024; // 2MB
const TARGET_SIZE = 500 * 1024; // 500KB
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

// 离线草稿队列Key
const DRAFT_KEY = 'upload_draft_queue';

/**
 * 压缩图片（如果超过阈值）
 * @param {string} filePath - 文件路径
 * @returns {Promise<string>} 压缩后的临时路径
 */
function compressImageIfNeeded(filePath) {
  return new Promise((resolve, reject) => {
    // 检查文件大小
    let fileSize = 0;
    try {
      const fileInfo = wx.getFileInfoSync(filePath);
      fileSize = fileInfo.size;
    } catch (e) {
      // 无法获取文件大小时，直接返回原路径
      resolve(filePath);
      return;
    }

    // 不需要压缩
    if (fileSize <= SIZE_THRESHOLD) {
      resolve(filePath);
      return;
    }

    // 需要压缩
    wx.compressImage({
      src: filePath,
      quality: COMPRESS_QUALITY,
      success: (res) => {
        // 压缩后可能仍然超过目标大小，再次压缩
        try {
          const compressedInfo = wx.getFileInfoSync(res.tempFilePath);
          if (compressedInfo.size > TARGET_SIZE) {
            // 再次压缩
            wx.compressImage({
              src: res.tempFilePath,
              quality: 60,
              success: (res2) => resolve(res2.tempFilePath),
              fail: () => resolve(res.tempFilePath) // 失败时使用第一次压缩结果
            });
          } else {
            resolve(res.tempFilePath);
          }
        } catch (e) {
          resolve(res.tempFilePath);
        }
      },
      fail: (err) => {
        console.error('图片压缩失败', err);
        resolve(filePath); // 失败时使用原图
      }
    });
  });
}

/**
 * 保存到离线草稿队列
 * @param {object} item - 待上传项
 */
function saveToDraftQueue(item) {
  const queue = wx.getStorageSync(DRAFT_KEY) || [];
  queue.push({
    ...item,
    timestamp: Date.now()
  });
  wx.setStorageSync(DRAFT_KEY, queue);
  debugLog('已存入离线草稿队列', item);
}

/**
 * 从离线草稿队列移除
 * @param {string} filePath - 文件路径
 */
function removeFromDraftQueue(filePath) {
  const queue = wx.getStorageSync(DRAFT_KEY) || [];
  const filtered = queue.filter(item => item.filePath !== filePath);
  wx.setStorageSync(DRAFT_KEY, filtered);
}

/**
 * 获取离线草稿队列
 */
function getDraftQueue() {
  return wx.getStorageSync(DRAFT_KEY) || [];
}

/**
 * 清除离线草稿队列
 */
function clearDraftQueue() {
  wx.setStorageSync(DRAFT_KEY, []);
}

/**
 * 带重试的上传函数
 * @param {function} uploadFn - 上传函数
 * @param {string} filePath - 文件路径
 * @param {string} fileType - 文件类型
 * @param {number} retryCount - 当前重试次数
 * @returns {Promise}
 */
async function uploadWithRetry(uploadFn, filePath, fileType = 'image', retryCount = 0) {
  try {
    const result = await uploadFn(filePath, fileType);
    // 上传成功，从草稿队列移除
    removeFromDraftQueue(filePath);
    return result;
  } catch (err) {
    if (retryCount < MAX_RETRIES - 1) {
      // 指数退避等待
      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      debugLog(`上传失败，${delay}ms后重试第${retryCount + 2}次`, filePath);
      await new Promise(r => setTimeout(r, delay));
      return uploadWithRetry(uploadFn, filePath, fileType, retryCount + 1);
    }
    // 超过重试次数，存入离线草稿
    console.error('上传失败，已存入离线草稿队列', filePath);
    saveToDraftQueue({ filePath, fileType, error: err.message });
    throw err;
  }
}

/**
 * 处理图片：压缩 + 上传（带重试）
 * @param {string} filePath - 文件路径
 * @param {function} uploadFn - 上传函数 (filePath, fileType) => Promise
 * @param {string} fileType - 文件类型
 * @returns {Promise}
 */
async function processAndUpload(filePath, uploadFn, fileType = 'image') {
  // 1. 压缩图片
  let processedPath = filePath;
  if (fileType === 'image') {
    processedPath = await compressImageIfNeeded(filePath);
  }

  // 2. 带重试上传
  return uploadWithRetry(uploadFn, processedPath, fileType, 0);
}

/**
 * 重试离线草稿队列中的上传
 * @param {function} uploadFn - 上传函数
 * @returns {Promise<{success: number, failed: number}>}
 */
async function retryDraftUploads(uploadFn) {
  const queue = getDraftQueue();
  if (queue.length === 0) {
    return { success: 0, failed: 0 };
  }

  debugLog('开始重试离线草稿，共', queue.length, '个');
  let success = 0;
  let failed = 0;
  const failedItems = [];

  for (const item of queue) {
    try {
      await uploadWithRetry(uploadFn, item.filePath, item.fileType, 0);
      success++;
    } catch (e) {
      failed++;
      failedItems.push(item);
    }
  }

  // 更新队列，保留失败的
  wx.setStorageSync(DRAFT_KEY, failedItems);

  debugLog(`离线草稿重试完成: 成功${success}个, 失败${failed}个`);
  return { success, failed };
}

/**
 * 小程序启动时自动重试草稿（异步，不阻塞启动）
 */
function autoRetryDrafts(uploadFn) {
  // 延迟3秒执行，避免阻塞启动
  setTimeout(async () => {
    const queue = getDraftQueue();
    if (queue.length > 0) {
      debugLog('检测到离线草稿，启动自动重试...');
      await retryDraftUploads(uploadFn);
    }
  }, 3000);
}

module.exports = {
  compressImageIfNeeded,
  saveToDraftQueue,
  removeFromDraftQueue,
  getDraftQueue,
  clearDraftQueue,
  uploadWithRetry,
  processAndUpload,
  retryDraftUploads,
  autoRetryDrafts,
  SIZE_THRESHOLD,
  TARGET_SIZE
};
