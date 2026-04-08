const { getDemandList } = require('../../utils/api');
const { formatDate, calcRemainingDays } = require('../../utils/time');

// 阶段选项
const STAGE_OPTIONS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'design', label: '设计阶段' },
  { value: 'construction', label: '施工阶段' },
  { value: 'opened', label: '已开通' },
  { value: 'rejected', label: '已驳回' }
];

// 阶段 -> 状态映射
const stageStatusMap = {
  pending: ['待审核'],
  design: ['设计中'],
  construction: ['施工中', '待确认'],
  opened: ['已开通'],
  rejected: ['已驳回']
};

// 根据状态计算剩余天数的标准
const STANDARD_DAYS = {
  '设计中': 2,
  '施工中': 5,
  '待确认': null,
  '已开通': null,
  '已驳回': null
};

function calcItemRemainingDays(item) {
  const status = item.status;
  const standardDays = STANDARD_DAYS[status];
  if (standardDays === null || standardDays === undefined) return null;
  if (status === '设计中') {
    return item.designAssignTime ? calcRemainingDays(item.designAssignTime, standardDays) : null;
  }
  if (status === '施工中') {
    return item.constructionAssignTime ? calcRemainingDays(item.constructionAssignTime, standardDays) : null;
  }
  return null;
}

Page({
  data: {
    list: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    // 筛选条件
    filterStage: '',
    filterType: '',
    // 阶段选项（根据角色差异化）
    stageOptions: STAGE_OPTIONS,
    effectiveStageOptions: STAGE_OPTIONS,
    currentRole: ''
  },

  onLoad(options) {
    const app = getApp();
    const currentRole = app.globalData.currentRole;
    // 按角色限制可选的筛选项
    const roleStageOptions = {
      DESIGN:       [{ value: '', label: '全部' }, { value: 'design', label: '设计阶段' }],
      CONSTRUCTION: [{ value: '', label: '全部' }, { value: 'construction', label: '施工阶段' }]
    };
    const effectiveStageOptions = roleStageOptions[currentRole] || STAGE_OPTIONS;
    this.setData({ currentRole, effectiveStageOptions });
    if (options.status) {
      // 兼容旧的 status 参数，转换为 stage
      const stageMap = { '待审核': 'pending', '设计中': 'design', '施工中': 'construction', '已开通': 'opened' };
      this.setData({ filterStage: stageMap[options.status] || '' });
    }
    this.loadList(true);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      if (tabBar.refreshTabs) tabBar.refreshTabs();
      if (tabBar.syncSelected) tabBar.syncSelected();
    }
    // 读取首页快捷入口通过 globalData 传入的筛选条件（switchTab 不支持 query params）
    const app = getApp();
    if (app.globalData.pendingFilter) {
      const { status } = app.globalData.pendingFilter;
      app.globalData.pendingFilter = null;
      const stageMap = { '待审核': 'pending', '设计中': 'design', '施工中': 'construction', '已开通': 'opened', '已驳回': 'rejected' };
      this.setData({ filterStage: stageMap[status] || '' });
    }
    this.loadList(true);
  },

  async loadList(reset = false) {
    if (this.data.loading) return;
    if (reset) {
      this.setData({ page: 1, list: [], hasMore: true });
    }
    if (!this.data.hasMore && !reset) return;

    this.setData({ loading: true });
    try {
      const statuses = this.data.filterStage ? stageStatusMap[this.data.filterStage] : undefined;
      const res = await getDemandList({
        page: this.data.page,
        pageSize: this.data.pageSize,
        status: statuses,
        type: this.data.filterType
      });
      const newList = res.data.list.map(item => ({
        ...item,
        id: item._id,  // demand-card 组件依赖 id 字段
        createdAt: formatDate(item.createdAt),
        remainingDays: calcItemRemainingDays(item),
        // 统一字段名供 demand-card 展示：姓名和电话组合
        submitter: item.createdBy?.name ? `${item.createdBy.name} ${item.createdBy.phone || ''}` : (item.createdBy?.phone || ''),
        location: item.locationDetail || ''
      }));
      this.setData({
        list: reset ? newList : [...this.data.list, ...newList],
        hasMore: newList.length === this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false });
      wx.showToast({ title: err.message || '加载失败', icon: 'none' });
    }
  },

  onReachBottom() {
    this.loadList(false);
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  onFilterStageChange(e) {
    this.setData({ filterStage: e.detail.value });
    this.loadList(true);
  },

  onTapDemand(e) {
    // 优先使用 triggerEvent 传递的 id，其次使用 dataset
    const id = e.detail?.id || e.currentTarget?.dataset?.id;
    if (!id) {
      console.error('工单点击 id 为空', e);
      return;
    }
    wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${id}` });
  }
});
