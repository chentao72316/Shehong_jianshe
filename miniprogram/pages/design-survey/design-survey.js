const { submitDesign, getDemandDetail } = require('../../utils/api');
const { uploadFile } = require('../../utils/request');
const { validateDesignForm } = require('../../utils/validate');
const app = getApp();
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

// 文件类型映射：扩展名 -> { type: 'image'|'pdf'|'doc'|'other', label: 显示名称, icon: 图标 }
const FILE_TYPE_MAP = {
  '.jpg': { type: 'image', label: 'JPG', icon: '' },
  '.jpeg': { type: 'image', label: 'JPEG', icon: '' },
  '.png': { type: 'image', label: 'PNG', icon: '' },
  '.gif': { type: 'image', label: 'GIF', icon: '' },
  '.webp': { type: 'image', label: 'WEBP', icon: '' },
  '.pdf': { type: 'pdf', label: 'PDF', icon: 'PDF' },
  '.doc': { type: 'doc', label: 'Word', icon: 'DOC' },
  '.docx': { type: 'doc', label: 'Word', icon: 'DOCX' },
  '.xls': { type: 'excel', label: 'Excel', icon: 'XLS' },
  '.xlsx': { type: 'excel', label: 'Excel', icon: 'XLSX' },
  '.ppt': { type: 'ppt', label: 'PPT', icon: 'PPT' },
  '.pptx': { type: 'ppt', label: 'PPT', icon: 'PPTX' },
  '.dwg': { type: 'cad', label: 'CAD', icon: 'DWG' },
  '.dxf': { type: 'cad', label: 'CAD', icon: 'DXF' },
  '.txt': { type: 'text', label: '文本', icon: 'TXT' },
  '.zip': { type: 'archive', label: '压缩包', icon: 'ZIP' },
  '.rar': { type: 'archive', label: '压缩包', icon: 'RAR' },
};

// 获取文件类型信息
function getFileTypeInfo(url) {
  if (!url) return { type: 'other', label: '文件', icon: 'FILE' };
  const ext = (url.match(/\.[^.]+$/) || [''])[0].toLowerCase();
  return FILE_TYPE_MAP[ext] || { type: 'other', label: '文件', icon: 'FILE' };
}

Page({
  data: {
    demandId: null,
    demand: null,
    form: {
      hasResource: null,   // true/false
      resourceName: '',
      resourcePhotos: [],
      designFiles: [],     // 多张设计图纸 URL 数组
      remark: ''
    },
    designFileTypes: [],   // 每个设计图纸对应的文件类型信息
    errors: {},
    submitting: false
  },

  onLoad(options) {
    this.setData({ demandId: options.demandId });
    this.loadDemand();
  },

  async loadDemand() {
    if (!this.data.demandId) return;
    try {
      const res = await getDemandDetail(this.data.demandId);
      const demand = res.data;
      // 已提交的需求不允许重复提交
      if (demand.status !== '设计中') {
        wx.showModal({
          title: '提示',
          content: `该需求当前状态为"${demand.status}"，查勘结果已提交，请勿重复操作。`,
          showCancel: false,
          confirmText: '知道了'
        });
      }
      this.setData({ demand });
    } catch {}
  },

  onResourceChange(e) {
    const hasResource = e.detail.value === '0';
    // 切换时有资源/无资源时，清空相关字段
    if (hasResource) {
      this.setData({
        'form.hasResource': true,
        'form.resourceName': '',
        'form.resourcePhotos': [],
        'form.designFiles': [],
        designFileTypes: []
      });
    } else {
      this.setData({
        'form.hasResource': false,
        'form.resourceName': '',
        'form.resourcePhotos': [],
        'form.designFiles': [],
        designFileTypes: []
      });
    }
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  async onUploadResourcePhotos() {
    const currentCount = this.data.form.resourcePhotos ? this.data.form.resourcePhotos.length : 0;
    const maxCount = 3 - currentCount;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传3张照片', icon: 'none' });
      return;
    }
    try {
      const res = await wx.chooseMedia({ count: maxCount, mediaType: ['image'] });
      if (!res.tempFiles || res.tempFiles.length === 0) return;
      wx.showLoading({ title: '上传中...' });
      try {
        const results = await Promise.all(res.tempFiles.map(f => uploadFile(f.tempFilePath, 'image')));
        const serverUrl = app.globalData.serverUrl || 'http://localhost:3000';
        const urls = results.map(r => serverUrl + r.data.url);
        this.setData({ 'form.resourcePhotos': [...this.data.form.resourcePhotos, ...urls] });
        wx.showToast({ title: '上传成功', icon: 'success' });
      } finally {
        wx.hideLoading();
      }
    } catch (err) {
      console.error('上传照片失败:', err);
      wx.hideLoading();
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      }
    }
  },

  // 预览设计图发送照片
  onPreviewResourcePhoto(e) {
    const { index } = e.currentTarget.dataset;
    wx.previewImage({
      urls: this.data.form.resourcePhotos,
      current: this.data.form.resourcePhotos[index]
    });
  },

  // 删除设计图发送照片
  onDeleteResourcePhoto(e) {
    const { index } = e.currentTarget.dataset;
    const photos = [...this.data.form.resourcePhotos];
    photos.splice(index, 1);
    this.setData({ 'form.resourcePhotos': photos });
  },

  // 预览设计图纸
  onPreviewDesignFile(e) {
    const { index } = e.currentTarget.dataset;
    const url = this.data.form.designFiles[index];
    const fileType = this.data.designFileTypes[index] || getFileTypeInfo(url);
    if (fileType.type === 'image') {
      // 图片用预览
      wx.previewImage({
        urls: this.data.form.designFiles,
        current: url
      });
    } else {
      // 非图片文件用 wx.openDocument 打开
      wx.showLoading({ title: '正在打开...' });
      wx.downloadFile({
        url: url,
        success: (res) => {
          wx.hideLoading();
          if (res.statusCode === 200) {
            wx.openDocument({
              filePath: res.tempFilePath,
              success: () => {},
              fail: () => {
                wx.showToast({ title: `无法打开 ${fileType.label} 文件`, icon: 'none' });
              }
            });
          } else {
            wx.showToast({ title: '文件打开失败', icon: 'none' });
          }
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '文件下载失败', icon: 'none' });
        }
      });
    }
  },

  // 删除设计图纸
  onDeleteDesignFile(e) {
    const { index } = e.currentTarget.dataset;
    const files = this.data.form.designFiles ? [...this.data.form.designFiles] : [];
    const fileTypes = [...this.data.designFileTypes];
    if (index >= 0 && index < files.length) {
      files.splice(index, 1);
      fileTypes.splice(index, 1);
      this.setData({ 'form.designFiles': files, designFileTypes: fileTypes });
    }
  },

  async onUploadDesignFile() {
    const currentCount = this.data.form.designFiles ? this.data.form.designFiles.length : 0;
    const maxCount = 3 - currentCount;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传3张图纸', icon: 'none' });
      return;
    }
    // 弹出选择：上传图片 or 上传文件（默认选项为"图片"）
    wx.showActionSheet({
      itemList: ['上传图片', '上传文件'],
      success: (res) => {
        const isImage = res.tapIndex === 0;
        this.doUploadDesignFile(maxCount, isImage);
      },
      fail: () => {} // 用户取消
    });
  },

  async doUploadDesignFile(maxCount, isImage) {
    try {
      let res;
      if (isImage) {
        // 上传图片
        res = await wx.chooseMedia({
          count: maxCount,
          mediaType: ['image'],
          sourceType: ['album', 'camera']
        });
        debugLog('选择图片结果:', res);
      } else {
        // 上传文件（支持任意文件类型）
        // 注意：不指定 type，让用户可以选择所有文件类型
        res = await wx.chooseMessageFile({
          count: maxCount
        });
        debugLog('选择文件结果:', res);
      }
      // 兼容 chooseMessageFile 和 chooseMedia 的返回格式
      const tempFiles = res.tempFiles || res.tempFiles;
      if (!tempFiles || tempFiles.length === 0) return;
      wx.showLoading({ title: '上传中...' });
      try {
        debugLog('准备上传的文件:', tempFiles);
        // 兼容 chooseMessageFile (path) 和 chooseMedia (tempFilePath) 的返回格式
        const validFiles = tempFiles.filter(f => f.tempFilePath || f.path);
        if (validFiles.length === 0) {
          wx.hideLoading();
          wx.showToast({ title: '文件路径无效', icon: 'none' });
          return;
        }
        // 根据 isImage 参数决定上传类型：图片用 'image'，文件用 'file'
        const uploadType = isImage ? 'image' : 'file';
        const results = await Promise.all(validFiles.map(f => uploadFile(f.tempFilePath || f.path, uploadType)));
        const serverUrl = app.globalData.serverUrl || 'http://localhost:3000';
        const urls = results.map(r => serverUrl + r.data.url);
        // 根据 isImage 参数决定文件类型：图片直接标记为 image 类型，文件根据 URL 扩展名判断
        const newFileTypes = isImage
          ? urls.map(() => ({ type: 'image', label: '图片', icon: '' }))
          : urls.map(url => getFileTypeInfo(url));
        const newDesignFiles = [...this.data.form.designFiles, ...urls];
        const newDesignFileTypes = [...this.data.designFileTypes, ...newFileTypes];
        this.setData({
          'form.designFiles': newDesignFiles,
          designFileTypes: newDesignFileTypes,
          errors: {}
        });
        wx.hideLoading();  // 先关 loading，再显示 toast，避免 showLoading/hideLoading 不配对警告
        wx.showToast({ title: '上传成功', icon: 'success' });
        debugLog('设计图纸已上传:', newDesignFiles, '类型:', newFileTypes);
      } catch (uploadErr) {
        console.error('上传文件失败:', uploadErr);
        wx.hideLoading();
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      } finally {
        // hideLoading 已在成功/失败分支各自调用，finally 不再重复调用
      }
    } catch (err) {
      console.error('选择媒体失败:', err);
      if (err.errMsg && !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '上传失败，请重试', icon: 'none' });
      }
    }
  },

  async onSubmit() {
    // 清除之前的错误
    this.setData({ errors: {} });

    const { valid, errors } = validateDesignForm(this.data.form);
    debugLog('表单验证结果:', valid, errors);
    debugLog('表单数据:', this.data.form);
    if (!valid) {
      this.setData({ errors });
      const firstError = Object.values(errors)[0];
      wx.showToast({ title: firstError || '请完善必填信息', icon: 'none', duration: 2500 });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true, errors: {} });
    try {
      wx.showLoading({ title: '提交中...' });
      debugLog('开始提交到服务器...');
      const res = await submitDesign({ demandId: this.data.demandId, ...this.data.form });
      debugLog('提交成功:', res);
      wx.hideLoading();
      wx.showToast({ title: '查勘提交成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/design-task/design-task' });
      }, 1500);
    } catch (err) {
      console.error('提交失败:', err);
      wx.hideLoading();
      this.setData({ submitting: false });
      // wx.showToast title 有字符数限制，服务端错误信息用 showModal 完整展示
      wx.showModal({
        title: '提交失败',
        content: err.message || '未知错误，请重试',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  }
});
