const { getStaffConfig, updateStaff, reassign, getDemandDetail, getStaffDistinct } = require('../../utils/api');
const { ROLES } = require('../../utils/constants');

const PAGE_SIZE = 15;
const DISTRICT_OPTIONS = ['射洪市', '蓬溪县', '大英县', '船山区', '安居区'];

function normalizeServiceDistricts(serviceDistricts, district) {
  const list = Array.isArray(serviceDistricts) ? serviceDistricts : [];
  const normalized = [...new Set(list.filter(item => DISTRICT_OPTIONS.includes(item)))];
  if (district && DISTRICT_OPTIONS.includes(district) && !normalized.includes(district)) {
    normalized.unshift(district);
  }
  return normalized;
}

function buildDistrictCheckOptions(serviceDistricts) {
  const selected = new Set(serviceDistricts || []);
  return DISTRICT_OPTIONS.map(name => ({ name, checked: selected.has(name) }));
}

Page({
  data: {
    staffList: [],
    loading: false,
    // 分页
    page: 1,
    total: 0,
    totalPages: 1,
    pageSize: PAGE_SIZE,
    // 编辑弹窗
    showEditModal: false,
    editingStaff: null,
    roleOptions: Object.entries(ROLES).map(([key, label]) => ({ key, label })),
    districtOptions: DISTRICT_OPTIONS,
    districtCheckOptions: buildDistrictCheckOptions([]),
    // 单位/网格下拉选项
    areaOptions: [],
    gridNameOptions: [],
    // 字段选择弹窗
    showFieldPicker: false,
    fieldPickerType: '',   // 'area' | 'gridName'
    fieldPickerTitle: '',
    fieldOptionList: [],
    showFieldManualInput: false,
    fieldManualInputValue: '',
    // 指派模式
    assignMode: false,
    demandId: null,
    demand: null
  },

  onLoad(options) {
    if (options.mode === 'assign' && options.demandId) {
      this.setData({ assignMode: true, demandId: options.demandId });
      this.loadDemandInfo();
    }
    this.loadStaff();
    this.loadDistinctOptions();
  },

  async loadDistinctOptions() {
    try {
      const res = await getStaffDistinct();
      const { areas = [], gridNames = [] } = res.data || {};
      this.setData({ areaOptions: areas, gridNameOptions: gridNames });
    } catch {}
  },

  async loadDemandInfo() {
    try {
      const res = await getDemandDetail(this.data.demandId);
      this.setData({ demand: res.data });
    } catch {}
  },

  async loadStaff() {
    this.setData({ loading: true });
    try {
      const res = await getStaffConfig({ page: this.data.page, pageSize: PAGE_SIZE });
      let staffList = (res.data.list || []).map(staff => ({
        ...staff,
        serviceDistricts: normalizeServiceDistricts(staff.serviceDistricts, staff.district),
        roleLabel: (staff.roles || []).map(r => ROLES[r]).filter(Boolean).join('/'),
        serviceDistrictsText: normalizeServiceDistricts(staff.serviceDistricts, staff.district).join('、')
      }));

      // 指派模式：只显示设计单位
      if (this.data.assignMode) {
        staffList = staffList.filter(staff =>
          staff.roles && staff.roles.includes('DESIGN')
        );
      }

      this.setData({
        staffList,
        total: res.data.total || 0,
        totalPages: Math.ceil((res.data.total || 0) / PAGE_SIZE) || 1,
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onPrevPage() {
    if (this.data.page <= 1) return;
    this.setData({ page: this.data.page - 1 });
    this.loadStaff();
  },

  onNextPage() {
    if (this.data.page >= this.data.totalPages) return;
    this.setData({ page: this.data.page + 1 });
    this.loadStaff();
  },

  // 指派模式：选择设计单位
  onSelectStaff(e) {
    if (!this.data.assignMode) return;
    const { index } = e.currentTarget.dataset;
    const staff = this.data.staffList[index];
    wx.showModal({
      title: '确认指派',
      content: `确认将需求指派给 ${staff.name} (${staff.phone})？`,
      success: async (res) => {
        if (res.confirm) {
          await this.doAssign(staff.id);
        }
      }
    });
  },

  async doAssign(userId) {
    try {
      wx.showLoading({ title: '指派中...' });
      await reassign({ demandId: this.data.demandId, unitType: 'design', userId });
      wx.hideLoading();
      wx.showToast({ title: '指派成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '指派失败: ' + (err.message || '未知错误'), icon: 'none' });
    }
  },

  onEditStaff(e) {
    const { index } = e.currentTarget.dataset;
    const staff = this.data.staffList[index];
    this.setData({
      showEditModal: true,
      editingStaff: {
        ...staff,
        index,
        serviceDistricts: normalizeServiceDistricts(staff.serviceDistricts, staff.district)
      },
      districtCheckOptions: buildDistrictCheckOptions(normalizeServiceDistricts(staff.serviceDistricts, staff.district))
    });
  },

  onEditInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`editingStaff.${field}`]: e.detail.value });
  },

  onEditRoleChange(e) {
    const { key, label } = this.data.roleOptions[e.detail.value];
    this.setData({ 'editingStaff.roles': [key], 'editingStaff.roleLabel': label });
  },

  onServiceDistrictChange(e) {
    const values = normalizeServiceDistricts(e.detail.value, this.data.editingStaff.district);
    this.setData({
      'editingStaff.serviceDistricts': values,
      districtCheckOptions: buildDistrictCheckOptions(values)
    });
  },

  async onSaveStaff() {
    const staff = this.data.editingStaff;
    if (!staff.name || !staff.phone) {
      wx.showToast({ title: '姓名和手机号不能为空', icon: 'none' });
      return;
    }
    try {
      await updateStaff({
        ...staff,
        userId: staff.id,
        serviceDistricts: normalizeServiceDistricts(staff.serviceDistricts, staff.district)
      });
      this.setData({ showEditModal: false, editingStaff: null });
      this.loadStaff();
    } catch {}
  },

  onCloseModal() {
    this.setData({ showEditModal: false, editingStaff: null });
  },

  onOpenFieldPicker(e) {
    const { type } = e.currentTarget.dataset;
    const isArea = type === 'area';
    this.setData({
      showFieldPicker: true,
      fieldPickerType: type,
      fieldPickerTitle: isArea ? '选择单位' : '选择部门/网格',
      fieldOptionList: isArea ? this.data.areaOptions : this.data.gridNameOptions,
      showFieldManualInput: false,
      fieldManualInputValue: ''
    });
  },

  onSelectFieldOption(e) {
    const { value } = e.currentTarget.dataset;
    const key = this.data.fieldPickerType;
    this.setData({ [`editingStaff.${key}`]: value, showFieldPicker: false });
  },

  onShowFieldManualInput() {
    this.setData({ showFieldManualInput: true });
  },

  onFieldManualInputChange(e) {
    this.setData({ fieldManualInputValue: e.detail.value });
  },

  onConfirmFieldManualInput() {
    const value = this.data.fieldManualInputValue.trim();
    if (!value) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    const key = this.data.fieldPickerType;
    this.setData({ [`editingStaff.${key}`]: value, showFieldPicker: false, showFieldManualInput: false, fieldManualInputValue: '' });
  },

  onCloseFieldPicker() {
    this.setData({ showFieldPicker: false, showFieldManualInput: false, fieldManualInputValue: '' });
  },

  noop() {}
});
