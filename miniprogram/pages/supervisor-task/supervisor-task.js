const { getDemandList } = require('../../utils/api');
const { formatDate, calcRemainingDays } = require('../../utils/time');

const FILTER_OPTIONS = [
  { value: '', label: '全部' },
  { value: '施工中', label: '施工中' },
  { value: '待确认', label: '待确认' },
  { value: '已开通', label: '已开通' },
  { value: '已驳回', label: '已驳回' }
];

Page({
  data: {
    tasks: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    filterStatus: '',
    filterOptions: FILTER_OPTIONS
  },

  onLoad() {
    this.loadTasks(true);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      if (tabBar.refreshTabs) tabBar.refreshTabs();
      if (tabBar.syncSelected) tabBar.syncSelected();
    }
    this.loadTasks(true);
  },

  async loadTasks(reset = false) {
    if (this.data.loading) return;
    if (reset) this.setData({ page: 1, tasks: [], hasMore: true });
    if (!this.data.hasMore && !reset) return;

    this.setData({ loading: true });
    try {
      const res = await getDemandList({
        page: this.data.page,
        pageSize: this.data.pageSize,
        role: 'SUPERVISOR',
        status: this.data.filterStatus || undefined
      });
      const tasks = res.data.list.map(item => ({
        ...item,
        id: item._id || item.id,
        createdAt: formatDate(item.createdAt),
        remainingDays: item.constructionAssignTime
          ? calcRemainingDays(item.constructionAssignTime, 5)
          : null,
        submitter: item.createdBy?.name ? `${item.createdBy.name} ${item.createdBy.phone || ''}` : (item.createdBy?.phone || ''),
        location: item.locationDetail || ''
      }));
      this.setData({
        tasks: reset ? tasks : [...this.data.tasks, ...tasks],
        hasMore: tasks.length === this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onFilterChange(e) {
    this.setData({ filterStatus: e.detail.value });
    this.loadTasks(true);
  },

  onReachBottom() {
    this.loadTasks(false);
  },

  onPullDownRefresh() {
    this.loadTasks(true).then(() => wx.stopPullDownRefresh());
  },

  onTapTask(e) {
    const id = e.detail?.id;
    wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${id}` });
  }
});
