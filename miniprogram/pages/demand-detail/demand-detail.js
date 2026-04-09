const { getDemandDetail, forceStatus, addRemark, startConstruction, rejectDemand, confirmDemand, crossAreaReview, acknowledgeRejection } = require('../../utils/api');
const { formatTime, calcRemainingDays } = require('../../utils/time');
const { STATUS_PROGRESS, DEMAND_STATUS, DEMAND_STEPS, DEMAND_STEPS_CROSS_AREA, DEMAND_STEPS_HAS_RESOURCE, DEMAND_STEPS_CROSS_AREA_HAS_RESOURCE } = require('../../utils/constants');

// 根据日志内容关键词判断圆点颜色
function getTimelineColor(content) {
  if (!content) return '#8C8C8C';
  if (content.includes('驳回') || content.includes('拒绝')) return '#F5222D';   // 红
  if (content.includes('已开通') || content.includes('开通确认') || content.includes('网络支撑经理')) return '#1E6F3F'; // 深绿
  if (content.includes('施工') || content.includes('竣工') || content.includes('开工')) return '#FA8C16'; // 橙
  if (content.includes('设计') || content.includes('查勘') || content.includes('有资源') || content.includes('无资源')) return '#722ED1'; // 紫
  if (content.includes('创建') || content.includes('提交') || content.includes('重新提交') || content.includes('录入')) return '#1890FF'; // 蓝
  if (content.includes('跨区域') || content.includes('审核')) return '#13C2C2'; // 青
  if (content.includes('指派') || content.includes('催办') || content.includes('备注')) return '#597EF7'; // 靛蓝
  return '#8C8C8C'; // 灰（系统/其他）
}


function processUrls(arr, serverUrl) {
  return (arr || []).map(url => {
    const fullUrl = url.startsWith('http') ? url : serverUrl + url;
    const ext = (fullUrl.split('.').pop() || '').toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
    return { url: fullUrl, name: fullUrl.split('/').pop(), type: isImage ? 'image' : 'file' };
  });
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addName(names, value) {
  if (!value) return;
  if (typeof value === 'string') {
    names.add(value.trim());
    return;
  }
  const name = value.name || value.realName || value.nickname || value.username;
  if (name) names.add(String(name).trim());
}

function getDemandNames(demand) {
  const names = new Set();
  const userFields = [
    'assignedDesignUnit',
    'assignedConstructionUnit',
    'assignedSupervisor',
    'confirmBy',
    'crossAreaReviewerId',
    'rejectedBy',
    'networkManager'
  ];

  userFields.forEach(field => addName(names, demand[field]));

  return Array.from(names)
    .filter(name => name && name.length >= 2)
    .sort((a, b) => b.length - a.length);
}

function buildTimelineContentParts(content, names) {
  const text = content || '';
  if (!text || !names.length) return [{ text, highlight: false }];

  const nameRegExp = new RegExp(`(${names.map(escapeRegExp).join('|')})`, 'g');
  return text.split(nameRegExp)
    .filter(Boolean)
    .map(part => ({
      text: part,
      highlight: names.includes(part)
    }));
}

Page({
  data: {
    id: null,
    demand: null,
    timeline: [],
    progress: 0,
    remainingDays: null,
    currentRole: '',
    userGridName: '',
    demandSteps: [],
    designSubmitted: false,
    constructionSubmitted: false,
    needsRefresh: false,
    // 干预弹窗
    showRemarkModal: false,
    showRejectModal: false,
    showRejectConstructionModal: false,
    showForceStatusModal: false,
    showCrossAreaRejectModal: false,
    remarkText: '',
    rejectReason: '',
    rejectConstructionReason: '',
    forceStatusTarget: '',
    forceStatusReason: '',
    crossAreaRejectNote: '',
    forceStatusOptions: Object.values(DEMAND_STATUS),
    loading: true
  },

  onLoad(options) {
    const app = getApp();
    const userInfo = app.globalData.userInfo;
    this.setData({
      id: options.id,
      currentRole: app.globalData.currentRole,
      _userId: userInfo ? String(userInfo._id || '') : '',
      userGridName: userInfo ? (userInfo.gridName || '') : ''
    });
    this.loadDetail();
  },

  onShow() {
    if (this.data.needsRefresh && this.data.id) {
      this.setData({ needsRefresh: false });
      this.loadDetail();
    }
  },

  async loadDetail() {
    if (!this.data.id) return;
    this.setData({ loading: true });
    try {
      const res = await getDemandDetail(this.data.id);
      const demand = res.data;
      const timelineNames = getDemandNames(demand);
      const timeline = (demand.logs || []).map(log => ({
        time: formatTime(log.createdAt),
        content: log.content,
        contentParts: buildTimelineContentParts(log.content, timelineNames),
        operator: log.operatorName,
        color: getTimelineColor(log.content)
      }));

      const serverUrl = getApp().globalData.serverUrl || 'http://localhost:3000';

      // 处理原始附件
      demand.photos = processUrls(demand.photos, serverUrl);
      // 处理设计查勘文件
      demand.designFiles = processUrls(demand.designFiles, serverUrl);
      demand.resourcePhotos = processUrls(demand.resourcePhotos, serverUrl);
      // 处理施工照片
      demand.constructionPhotos = processUrls(demand.constructionPhotos, serverUrl);

      // 根据当前阶段计算剩余天数
      let remainingDays = null;
      const status = demand.status;
      if (status === '设计中' && demand.designAssignTime) {
        remainingDays = calcRemainingDays(demand.designAssignTime, 2);
      } else if (status === '施工中' && demand.constructionAssignTime) {
        remainingDays = calcRemainingDays(demand.constructionAssignTime, 5);
      }

      // 步骤条模板：根据有资源 + 跨区域两个维度选择
      let stepsTemplate;
      if (demand.hasResource) {
        stepsTemplate = demand.crossAreaReviewerId ? DEMAND_STEPS_CROSS_AREA_HAS_RESOURCE : DEMAND_STEPS_HAS_RESOURCE;
      } else {
        stepsTemplate = demand.crossAreaReviewerId ? DEMAND_STEPS_CROSS_AREA : DEMAND_STEPS;
      }
      const currentStepIndex = stepsTemplate.findIndex(s => s.statuses.includes(status));
      // 已开通是终态，最后一步也应标为 done（绿色），不能只用 current（蓝色）
      const isCompleted = status === '已开通';
      const steps = stepsTemplate.map((step, idx) => ({
        key: step.key,
        label: step.label,
        done: currentStepIndex > idx || (isCompleted && currentStepIndex === idx),
        current: !isCompleted && step.statuses.includes(status),
        before: currentStepIndex !== -1 && currentStepIndex < idx
      }));

      this.setData({
        demand,
        timeline,
        progress: STATUS_PROGRESS[demand.status] || 0,
        remainingDays,
        demandSteps: steps,
        designSubmitted: demand.hasResource !== undefined && demand.hasResource !== null,
        constructionSubmitted: !!demand.coverageName,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
      if (err.message === '需求不存在') {
        setTimeout(() => wx.navigateBack(), 1500);
      }
    }
  },
  onAssign() {
    if (!this.data.id) {
      wx.showToast({ title: '需求ID不存在', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/staff-config/staff-config?mode=assign&demandId=${this.data.id}` });
  },

  // 一线人员：驳回后重新提交
  onResubmit() {
    wx.navigateTo({ url: `/pages/demand-create/demand-create?demandId=${this.data.id}` });
  },

  // 查看驳回原因
  onViewRejection() {
    const reason = this.data.demand && this.data.demand.rejectionReason;
    wx.showModal({
      title: '驳回原因',
      content: reason || '暂无驳回原因记录',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 一线人员：确认驳回，工单不再出现在待办列表
  async onConfirmReject() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认驳回',
        content: '确认后该工单将终止，不再出现在待办列表。如需继续，请选择"重新提交"。',
        confirmText: '确认驳回',
        cancelText: '取消',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;
    try {
      wx.showLoading({ title: '提交中...' });
      await acknowledgeRejection(this.data.id);
      wx.hideLoading();
      wx.showToast({ title: '已确认驳回', icon: 'success' });
      wx.navigateBack();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 预览照片
  onPreviewPhoto(e) {
    const { urls, index } = e.currentTarget.dataset;
    const imageUrls = (urls || []).filter(u => u.type === 'image').map(u => u.url);
    if (!imageUrls.length) return;
    wx.previewImage({ urls: imageUrls, current: imageUrls[index] || imageUrls[0] });
  },

  // 预览文件
  onPreviewFile(e) {
    wx.showToast({ title: '点击文件名下载查看', icon: 'none' });
  },

  // 设计单位：进入查勘填报页
  onGoDesignSurvey() {
    wx.navigateTo({ url: `/pages/design-survey/design-survey?demandId=${this.data.id}` });
  },

  // 施工单位：确认开工
  async onStartConstruction() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认开工',
        content: '确认已到达现场并开始施工？',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;
    try {
      wx.showLoading({ title: '提交中...' });
      await startConstruction({ demandId: this.data.id });
      wx.hideLoading();
      wx.showToast({ title: '已确认开工', icon: 'success' });
      this.loadDetail();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 施工单位：提交竣工资料
  onGoConstructionSubmit() {
    wx.navigateTo({ url: `/pages/construction-submit/construction-submit?demandId=${this.data.id}` });
  },

  // 管理员：强制修改状态
  onOpenForceStatus() {
    this.setData({ showForceStatusModal: true, forceStatusTarget: '', forceStatusReason: '' });
  },

  onForceStatusChange(e) {
    this.setData({ forceStatusTarget: this.data.forceStatusOptions[e.detail.value] });
  },

  onForceReasonInput(e) {
    this.setData({ forceStatusReason: e.detail.value });
  },

  async onSubmitForceStatus() {
    if (!this.data.forceStatusTarget) {
      wx.showToast({ title: '请选择目标状态', icon: 'none' });
      return;
    }
    if (!this.data.forceStatusReason.trim()) {
      wx.showToast({ title: '请输入操作原因', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '提交中...' });
      await forceStatus({ id: this.data.id, status: this.data.forceStatusTarget, reason: this.data.forceStatusReason });
      wx.hideLoading();
      this.setData({ showForceStatusModal: false, forceStatusTarget: '', forceStatusReason: '' });
      this.loadDetail();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  // 添加备注
  onAddRemark() {
    this.setData({ showRemarkModal: true });
  },

  onRemarkInput(e) {
    this.setData({ remarkText: e.detail.value });
  },

  async onSubmitRemark() {
    if (!this.data.remarkText.trim()) {
      wx.showToast({ title: '请输入备注内容', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '提交中...' });
      await addRemark({ id: this.data.id, remark: this.data.remarkText });
      wx.hideLoading();
      this.setData({ showRemarkModal: false, remarkText: '' });
      this.loadDetail();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  },

  onCloseModal() {
    this.setData({
      showRemarkModal: false, remarkText: '',
      showRejectModal: false, rejectReason: '',
      showRejectConstructionModal: false, rejectConstructionReason: '',
      showForceStatusModal: false, forceStatusTarget: '', forceStatusReason: '',
      showCrossAreaRejectModal: false, crossAreaRejectNote: ''
    });
  },

  // 网格经理：驳回需求
  onRejectDemand() {
    this.setData({ showRejectModal: true });
  },

  onRejectReasonInput(e) {
    this.setData({ rejectReason: e.detail.value });
  },

  async onSubmitReject() {
    if (!this.data.rejectReason.trim()) {
      wx.showToast({ title: '请输入驳回原因', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '提交中...' });
      await rejectDemand({ id: this.data.id, reason: this.data.rejectReason });
      wx.hideLoading();
      this.setData({ showRejectModal: false, rejectReason: '' });
      this.loadDetail();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '驳回失败', icon: 'none' });
    }
  },

  // 网格经理/网络支撑经理：确认开通
  async onConfirmDemand() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认开通',
        content: '确认施工质量合格，需求开通？',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;
    try {
      wx.showLoading({ title: '提交中...' });
      await confirmDemand({ demandId: this.data.id, action: 'approve' });
      wx.hideLoading();
      wx.showToast({ title: '已确认开通', icon: 'success' });
      this.loadDetail();
    } catch {
      wx.hideLoading();
    }
  },

  // 网格经理/网络支撑经理：驳回施工
  onRejectConstruction() {
    this.setData({ showRejectConstructionModal: true, rejectConstructionReason: '' });
  },

  onRejectConstructionReasonInput(e) {
    this.setData({ rejectConstructionReason: e.detail.value });
  },

  async onSubmitRejectConstruction() {
    if (!this.data.rejectConstructionReason.trim()) {
      wx.showToast({ title: '请输入驳回原因', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '提交中...' });
      await confirmDemand({ demandId: this.data.id, action: 'reject', rejectReason: this.data.rejectConstructionReason });
      wx.hideLoading();
      wx.showToast({ title: '已驳回施工', icon: 'success' });
      this.setData({ showRejectConstructionModal: false, rejectConstructionReason: '' });
      this.loadDetail();
    } catch {
      wx.hideLoading();
    }
  },

  // 网格经理：跨区域审核通过
  async onApproveCrossArea() {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '确认审核通过',
        content: '审核通过后将自动指派设计单位并进入设计环节',
        success: res => resolve(res.confirm)
      });
    });
    if (!confirmed) return;
    try {
      wx.showLoading({ title: '提交中...' });
      await crossAreaReview({ demandId: this.data.id, approve: true });
      wx.hideLoading();
      wx.showToast({ title: '审核通过', icon: 'success' });
      this.loadDetail();
    } catch {
      wx.hideLoading();
    }
  },

  // 网格经理：跨区域审核驳回
  onOpenCrossAreaReject() {
    this.setData({ showCrossAreaRejectModal: true, crossAreaRejectNote: '' });
  },

  onCrossAreaRejectNoteInput(e) {
    this.setData({ crossAreaRejectNote: e.detail.value });
  },

  async onSubmitCrossAreaReject() {
    if (!this.data.crossAreaRejectNote.trim()) {
      wx.showToast({ title: '请输入驳回原因', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '提交中...' });
      await crossAreaReview({ demandId: this.data.id, approve: false, note: this.data.crossAreaRejectNote });
      wx.hideLoading();
      wx.showToast({ title: '已驳回', icon: 'success' });
      this.setData({ showCrossAreaRejectModal: false, crossAreaRejectNote: '' });
      this.loadDetail();
    } catch {
      wx.hideLoading();
    }
  }
});
