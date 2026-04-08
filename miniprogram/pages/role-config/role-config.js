const { getRoleConfigList, saveRoleConfig } = require('../../utils/api');

const SCOPE_OPTIONS = [
  { value: 'all',      label: '全部',   desc: '可见所有工单' },
  { value: 'area',     label: '区域',   desc: '只见本支撑区域的工单（acceptArea = user.area）' },
  { value: 'grid',     label: '网格',   desc: '只见本网格提交和受理的工单' },
  { value: 'self',     label: '仅自己', desc: '只见自己创建的工单' },
  { value: 'assigned', label: '指派给我', desc: '只见指派给自己的工单' }
];

const SCOPE_LABELS = {
  all: '全部', area: '区域', grid: '网格', self: '仅自己', assigned: '指派给我'
};

Page({
  data: {
    list: [],
    loading: true,
    showModal: false,
    saving: false,
    editItem: null,
    form: { visibilityScope: 'self' },
    scopeOptions: SCOPE_OPTIONS,
    scopeLabels: SCOPE_LABELS
  },

  onLoad() {
    this.loadList();
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res = await getRoleConfigList();
      this.setData({ list: res.data.list || [], loading: false });
    } catch {
      this.setData({ loading: false });
    }
  },

  onEdit(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      showModal: true,
      editItem: item,
      form: { visibilityScope: item.visibilityScope }
    });
  },

  onSelectScope(e) {
    this.setData({ 'form.visibilityScope': e.currentTarget.dataset.value });
  },

  async onSave() {
    this.setData({ saving: true });
    try {
      await saveRoleConfig({ role: this.data.editItem.role, visibilityScope: this.data.form.visibilityScope });
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
