const { getAreaConfigList, saveAreaConfig, deleteAreaConfig, getStaffConfig, getStaffDistinct } = require('../../utils/api');

const ROLE_PICK_MAP = {
  design: 'DESIGN',
  construction: 'CONSTRUCTION',
  supervisor: 'SUPERVISOR',
  networkManager: 'NETWORK_MANAGER'
};

Page({
  data: {
    list: [],
    loading: true,
    showModal: false,
    saving: false,
    editId: null,
    form: {
      acceptArea: '',
      networkCenter: '',
      designCandidates: [],
      constructionCandidates: [],
      supervisorCandidates: [],
      networkManager: null
    },
    // 受理区域/网络支撑中心选项
    areaOptions: [],          // 单位+网格合并列表
    networkCenterOptions: [], // 从已有配置提取
    // 字段选择弹窗（受理区域 & 网络支撑中心）
    showOptionPicker: false,
    optionPickerType: '',    // 'acceptArea' | 'networkCenter'
    optionPickerTitle: '',
    optionList: [],
    showManualInput: false,
    manualInputValue: '',
    // 人员选择弹窗
    showPickModal: false,
    pickType: '',        // 当前选择类型
    pickCandidates: [],  // 弹窗候选人列表
    selectedPickIds: {}, // 已选 id map
    singlePick: false    // 单选模式（networkManager）
  },

  onLoad() {
    this.loadList();
    this.loadDistinctOptions();
  },

  onShow() {
    this.loadList();
  },

  async loadDistinctOptions() {
    try {
      const res = await getStaffDistinct();
      const { areas = [], gridNames = [] } = res.data || {};
      const merged = [...new Set([...areas, ...gridNames])].sort();
      this.setData({ areaOptions: merged });
    } catch {}
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await getAreaConfigList();
      const list = (res.data.list || []).map(item => ({
        ...item,
        _designNames: (item.designCandidates || []).map(u => u.name).join('、') || '',
        _constructionNames: (item.constructionCandidates || []).map(u => u.name).join('、') || '',
        _supervisorNames: (item.supervisorCandidates || []).map(u => u.name).join('、') || '',
        _networkManagerName: item.networkManagerId ? item.networkManagerId.name : ''
      }));
      // 从列表提取网络支撑中心选项
      const networkCenterOptions = [...new Set(list.map(i => i.networkCenter).filter(Boolean))].sort();
      this.setData({ list, loading: false, networkCenterOptions });
    } catch {
      this.setData({ loading: false });
    }
  },

  onAdd() {
    this.setData({
      showModal: true,
      editId: null,
      form: { acceptArea: '', networkCenter: '', designCandidates: [], constructionCandidates: [], supervisorCandidates: [], networkManager: null }
    });
  },

  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true,
      editId: String(item._id),
      form: {
        acceptArea: item.acceptArea,
        networkCenter: item.networkCenter || '',
        designCandidates: (item.designCandidates || []).map(u => ({ id: String(u._id), name: u.name })),
        constructionCandidates: (item.constructionCandidates || []).map(u => ({ id: String(u._id), name: u.name })),
        supervisorCandidates: (item.supervisorCandidates || []).map(u => ({ id: String(u._id), name: u.name })),
        networkManager: item.networkManagerId ? { id: String(item.networkManagerId._id), name: item.networkManagerId.name } : null
      }
    });
  },

  async onDelete(e) {
    const { id } = e.currentTarget.dataset;
    const confirmed = await new Promise(resolve => {
      wx.showModal({ title: '确认删除', content: '删除后不可恢复，确认吗？', success: res => resolve(res.confirm) });
    });
    if (!confirmed) return;
    try {
      await deleteAreaConfig(id);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadList();
    } catch {}
  },

  onInputAcceptArea(e) { this.setData({ 'form.acceptArea': e.detail.value }); },
  onInputNetworkCenter(e) { this.setData({ 'form.networkCenter': e.detail.value }); },

  // 打开选项弹窗
  onOpenOptionPicker(e) {
    const { type } = e.currentTarget.dataset;
    // 编辑模式下受理区域不可修改
    if (type === 'acceptArea' && this.data.editId) return;
    const isAcceptArea = type === 'acceptArea';
    this.setData({
      showOptionPicker: true,
      optionPickerType: type,
      optionPickerTitle: isAcceptArea ? '选择受理区域' : '选择网络支撑中心',
      optionList: isAcceptArea ? this.data.areaOptions : this.data.networkCenterOptions,
      showManualInput: false,
      manualInputValue: ''
    });
  },

  onSelectOption(e) {
    const { value } = e.currentTarget.dataset;
    const key = this.data.optionPickerType;
    this.setData({ [`form.${key}`]: value, showOptionPicker: false });
  },

  onShowManualInput() {
    this.setData({ showManualInput: true });
  },

  onManualInputChange(e) {
    this.setData({ manualInputValue: e.detail.value });
  },

  onConfirmManualInput() {
    const value = this.data.manualInputValue.trim();
    if (!value) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    const key = this.data.optionPickerType;
    this.setData({ [`form.${key}`]: value, showOptionPicker: false, showManualInput: false, manualInputValue: '' });
  },

  onCloseOptionPicker() {
    this.setData({ showOptionPicker: false, showManualInput: false, manualInputValue: '' });
  },

  onRemoveCandidate(e) {
    const { type, idx } = e.currentTarget.dataset;
    if (type === 'networkManager') {
      this.setData({ 'form.networkManager': null });
    } else {
      const key = type + 'Candidates';
      const arr = [...this.data.form[key]];
      arr.splice(idx, 1);
      this.setData({ [`form.${key}`]: arr });
    }
  },

  async onPickCandidate(e) {
    const { type } = e.currentTarget.dataset;
    const role = ROLE_PICK_MAP[type];
    const singlePick = type === 'networkManager';
    try {
      wx.showLoading({ title: '加载人员...' });
      const res = await getStaffConfig({ role, pageSize: 200 });
      wx.hideLoading();
      const candidates = (res.data.list || []).filter(u => u.active !== false);

      // 初始化已选状态
      const selectedPickIds = {};
      if (!singlePick) {
        const currentList = this.data.form[type + 'Candidates'] || [];
        currentList.forEach(u => { selectedPickIds[u.id] = true; });
      } else if (this.data.form.networkManager) {
        selectedPickIds[this.data.form.networkManager.id] = true;
      }

      this.setData({ showPickModal: true, pickType: type, pickCandidates: candidates, selectedPickIds, singlePick });
    } catch {
      wx.hideLoading();
    }
  },

  onTogglePick(e) {
    const item = e.currentTarget.dataset.item;
    const id = String(item._id || item.id);
    if (this.data.singlePick) {
      this.setData({ selectedPickIds: { [id]: true } });
    } else {
      const updated = { ...this.data.selectedPickIds };
      updated[id] ? delete updated[id] : (updated[id] = true);
      this.setData({ selectedPickIds: updated });
    }
  },

  onConfirmPick() {
    const { pickType, pickCandidates, selectedPickIds, singlePick } = this.data;
    const selected = pickCandidates
      .filter(u => selectedPickIds[String(u._id || u.id)])
      .map(u => ({ id: String(u._id || u.id), name: u.name }));

    if (singlePick) {
      this.setData({ 'form.networkManager': selected[0] || null, showPickModal: false });
    } else {
      this.setData({ [`form.${pickType}Candidates`]: selected, showPickModal: false });
    }
  },

  onClosePickModal() {
    this.setData({ showPickModal: false });
  },

  async onSave() {
    const { form } = this.data;
    if (!form.acceptArea.trim()) {
      wx.showToast({ title: '请输入受理区域名称', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await saveAreaConfig({
        acceptArea: form.acceptArea.trim(),
        networkCenter: form.networkCenter,
        designCandidates: form.designCandidates.map(u => u.id),
        constructionCandidates: form.constructionCandidates.map(u => u.id),
        supervisorCandidates: form.supervisorCandidates.map(u => u.id),
        networkManagerId: form.networkManager ? form.networkManager.id : null
      });
      this.setData({ saving: false, showModal: false });
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.loadList();
    } catch {
      this.setData({ saving: false });
    }
  },

  onCloseModal() {
    this.setData({ showModal: false });
  }
});
