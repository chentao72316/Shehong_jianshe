const { submitConstruction, getDemandDetail } = require('../../utils/api');
const { uploadFile } = require('../../utils/request');
const { validateConstructionForm } = require('../../utils/validate');
const { ASSET_STATUS } = require('../../utils/constants');
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) console.log(...args);
}

Page({
  data: {
    demandId: null,
    demand: null,
    form: {
      coverageName: '',
      photos: [],
      assetStatus: '',
      latitude: null,
      longitude: null,
      remark: ''
    },
    errors: {},
    assetStatusOptions: ASSET_STATUS,
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
      this.setData({ demand: res.data });
    } catch {}
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onAssetStatusChange(e) {
    this.setData({ 'form.assetStatus': this.data.assetStatusOptions[e.detail.value] });
  },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'form.latitude': res.latitude,
          'form.longitude': res.longitude
        });
      }
    });
  },

  async onChoosePhotos() {
    const maxCount = 9 - this.data.form.photos.length;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传9张照片', icon: 'none' });
      return;
    }
    let res;
    try {
      res = await wx.chooseMedia({ count: maxCount, mediaType: ['image'] });
    } catch (err) {
      if (!err.errMsg || !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
      return;
    }
    if (!res.tempFiles || res.tempFiles.length === 0) return;
    wx.showLoading({ title: '上传中...' });
    const app = getApp();
    const serverUrl = app.globalData.serverUrl || 'http://localhost:3000';
    debugLog('选择文件数:', res.tempFiles.length);
    debugLog('serverUrl:', serverUrl);
    try {
      const results = await Promise.all(res.tempFiles.map(f => uploadFile(f.tempFilePath, 'image')));
      debugLog('上传结果:', results);
      const urls = results.map(r => serverUrl + r.data.url);
      debugLog('图片URLs:', urls);
      this.setData({ 'form.photos': [...this.data.form.photos, ...urls] });
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch (err) {
      console.error('上传失败:', err);
      wx.showToast({ title: '上传失败: ' + (err.message || '请重试'), icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onDeletePhoto(e) {
    const { index } = e.currentTarget.dataset;
    const photos = [...this.data.form.photos];
    photos.splice(index, 1);
    this.setData({ 'form.photos': photos });
  },

  async onSubmit() {
    const { valid, errors } = validateConstructionForm(this.data.form);
    if (!valid) {
      this.setData({ errors });
      wx.showToast({ title: '请完善必填信息', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      wx.showLoading({ title: '提交中...' });
      const { latitude, longitude, ...rest } = this.data.form;
      await submitConstruction({
        demandId: this.data.demandId,
        ...rest,
        location: (latitude && longitude) ? { latitude, longitude } : null
      });
      wx.hideLoading();
      wx.showToast({ title: '施工完工提交成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      console.error('提交失败:', err);
      wx.hideLoading();
      this.setData({ submitting: false });
      wx.showToast({ title: '提交失败: ' + (err.message || '请重试'), icon: 'none' });
    }
  }
});
