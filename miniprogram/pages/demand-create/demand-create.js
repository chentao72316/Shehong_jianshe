const { createDemand, updateDemand, getConfig } = require('../../utils/api');
const { uploadFile } = require('../../utils/request');
const { validateDemandForm } = require('../../utils/validate');

// 受理区域候选列表（从处理组配置提取）
const ACCEPT_AREAS = [
  '太和东服务中心', '太和西服务中心', '平安街道服务中心',
  '大榆服务中心', '仁和服务中心', '复兴服务中心',
  '沱牌服务中心', '金华服务中心', '太乙服务中心',
  '射洪分公司', '销售中心', '校园服务中心',
  '商客服务中心', '企业服务中心', '集团客户中心',
  '高质量服务中心'
];

Page({
  data: {
    form: {
      acceptArea: '',
      submitterPhone: '',
      demandPersonName: '',
      demandPersonPhone: '',
      businessType: '',
      demandType: '',
      reservedCustomers: '',
      dpBoxCount: '',
      latitude: null,
      longitude: null,
      locationDetail: '',
      photos: [],  // [{ url: string, name: string, type: 'image'|'file' }]
      urgency: '普通',
      remark: '',
      // 自动带出字段
      networkSupport: '',   // 网络支撑中心（根据服务中心自动带出）
      serviceCenter: ''     // 所属服务中心（根据提交人自动带出）
    },
    errors: {},
    userInfo: null,
    availableAreas: ACCEPT_AREAS,
    businessTypes: ['家宽', '专线', '无线', '其他'],
    demandTypes: ['新建', '扩容', '改造', '应急'],
    urgencyLevels: ['普通', '紧急', '特急'],
    editMode: false,
    demandId: null,
    submitting: false,
    isCrossArea: false,
    // 动态配置：服务中心 -> 网络支撑中心 映射
    centerNetworkMap: {}
  },

  onLoad(options) {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    this.setData({
      userInfo,
      _userGridName: (userInfo && userInfo.gridName) || '',
      'form.submitterPhone': (userInfo && userInfo.phone) || '',
      'form.serviceCenter': (userInfo && userInfo.gridName) || ''
    });

    // 加载服务中心与网络支撑中心映射配置
    this.loadCenterNetworkMap();

    if (options.demandId) {
      this.setData({ editMode: true, demandId: options.demandId });
      this.loadDemandForEdit(options.demandId);
    }
  },

  // 从后端加载服务中心与网络支撑中心映射配置
  async loadCenterNetworkMap() {
    try {
      const res = await getConfig('CENTER_NETWORK_MAP');
      if (res.data) {
        this.setData({ centerNetworkMap: res.data });
        // 初始加载后，根据服务中心的值设置网络支撑中心
        const serviceCenter = this.data.form.serviceCenter;
        if (serviceCenter) {
          this.setData({ 'form.networkSupport': res.data[serviceCenter] || '' });
        }
      }
    } catch (err) {
      console.error('加载服务中心映射配置失败', err);
    }
  },

  async loadDemandForEdit(id) {
    const { getDemandDetail } = require('../../utils/api');
    try {
      const res = await getDemandDetail(id);
      const d = res.data;
      // 转换 photos 数组为对象格式
      const serverUrl = getApp().globalData.serverUrl || 'http://localhost:3000';
      const photos = (d.photos || []).map(url => {
        const fullUrl = url.startsWith('http') ? url : serverUrl + url;
        const ext = fullUrl.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);
        return { url: fullUrl, name: fullUrl.split('/').pop(), type: isImage ? 'image' : 'file' };
      });
      this.setData({
        form: {
          ...this.data.form,
          acceptArea: d.acceptArea || '',
          networkSupport: d.networkSupport || '',
          serviceCenter: d.serviceCenter || '',
          submitterPhone: d.submitterPhone || '',
          demandPersonName: d.demandPersonName || '',
          demandPersonPhone: d.demandPersonPhone || '',
          businessType: d.businessType || '',
          demandType: d.type || '',
          reservedCustomers: d.reservedCustomers || '',
          dpBoxCount: d.dpBoxCount || '',
          latitude: d.latitude || null,
          longitude: d.longitude || null,
          locationDetail: d.locationDetail || '',
          photos,
          urgency: d.urgency || '普通',
          remark: d.remark || ''
        }
      });
    } catch (err) {
      console.error('加载需求详情失败', err);
    }
  },
  getNetworkSupportByCenter(center) {
    const map = this.data.centerNetworkMap;
    return map[center] || '';
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onAreaChange(e) {
    const area = this.data.availableAreas[e.detail.value];
    const networkSupport = this.getNetworkSupportByCenter(area);
    const userGridName = this.data._userGridName;
    const isCrossArea = !!userGridName && area !== userGridName;
    this.setData({
      'form.acceptArea': area,
      'form.networkSupport': networkSupport,
      isCrossArea
    });
  },

  onBusinessTypeChange(e) {
    this.setData({ 'form.businessType': this.data.businessTypes[e.detail.value] });
  },

  onDemandTypeChange(e) {
    this.setData({ 'form.demandType': this.data.demandTypes[e.detail.value] });
  },

  onUrgencyChange(e) {
    this.setData({ 'form.urgency': this.data.urgencyLevels[e.detail.value] });
  },

  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'form.latitude': res.latitude,
          'form.longitude': res.longitude,
          'form.locationDetail': res.address || this.data.form.locationDetail
        });
      },
      fail: (err) => {
        // 模拟器/无权限时，引导手动输入经纬度
        wx.showModal({
          title: '无法获取位置',
          content: '请手动输入经纬度，或在「工具 → 详情 → 地图选点」设置调试位置',
          confirmText: '手动输入',
          success: (modal) => {
            if (modal.confirm) {
              this._promptCoordinate();
            }
          }
        });
      }
    });
  },

  _promptCoordinate() {
    wx.showModal({
      title: '手动输入经纬度',
      editable: true,
      placeholderText: '格式：30.90,105.00（纬度,经度）',
      success: (res) => {
        if (res.confirm && res.content) {
          const parts = res.content.split(',').map(s => parseFloat(s.trim()));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            this.setData({
              'form.latitude': parts[0],
              'form.longitude': parts[1]
            });
          } else {
            wx.showToast({ title: '格式错误，请按「纬度,经度」填写', icon: 'none' });
          }
        }
      }
    });
  },

  async onChoosePhotos() {
    const maxCount = 6 - this.data.form.photos.length;
    if (maxCount <= 0) {
      wx.showToast({ title: '最多上传6个附件', icon: 'none' });
      return;
    }
    let res;
    try {
      // 使用 chooseImage（支持模拟器），仅限图片
      res = await wx.chooseImage({
        count: maxCount,
        sizeType: ['original', 'compressed'],
        sourceType: ['album', 'camera']
      });
    } catch (err) {
      if (!err.errMsg || !err.errMsg.includes('cancel')) {
        wx.showToast({ title: '选择图片失败', icon: 'none' });
      }
      return;
    }
    wx.showLoading({ title: '上传中...' });
    const app = getApp();
    const serverUrl = app.globalData.serverUrl || 'http://localhost:3000';
    try {
      const uploadTasks = res.tempFiles.map(f => ({
        upload: uploadFile(f.path, 'image'),
        name: f.path.split('/').pop(),
        isImage: true
      }));
      const uploadResults = await Promise.all(uploadTasks.map(t => t.upload));
      const newPhotos = uploadResults.map((r, i) => ({
        url: serverUrl + r.data.url,
        name: uploadTasks[i].name,
        type: 'image'
      }));
      this.setData({ 'form.photos': [...this.data.form.photos, ...newPhotos] });
      wx.showToast({ title: '上传成功', icon: 'success' });
    } catch {
      wx.hideLoading();
      wx.showToast({ title: '上传失败', icon: 'none' });
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
    const { valid, errors } = validateDemandForm(this.data.form);
    if (!valid) {
      this.setData({ errors });
      wx.showToast({ title: '请完善必填信息', icon: 'none' });
      return;
    }
    if (this.data.submitting) return;
    this.setData({ submitting: true });
    try {
      wx.showLoading({ title: '提交中...' });
      // 提取照片 URL 数组
      const photoUrls = this.data.form.photos.map(p => p.url);
      const submitData = {
        ...this.data.form,
        photos: photoUrls,
        demandNo: undefined,  // 由服务端生成，客户端不传
      };
      if (this.data.editMode) {
        await updateDemand({ id: this.data.demandId, resubmit: true, ...submitData });
      } else {
        await createDemand(submitData);
      }
      wx.hideLoading();
      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
      this.setData({ submitting: false });
    }
  }
});
