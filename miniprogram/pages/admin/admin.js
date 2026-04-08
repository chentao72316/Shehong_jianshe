const { getDemandList, getTimeoutList, getStaffConfig, getAreaConfigList } = require('../../utils/api');

Page({
  data: {
    stats: {
      total: 0, pending: 0, designing: 0, constructing: 0, done: 0, timeout: 0
    },
    timeoutCount: 0,
    staffCount: 0,
    areaConfigCount: 0
  },

  onLoad() {
    this.loadAdminData();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      if (tabBar.refreshTabs) tabBar.refreshTabs();
      if (tabBar.syncSelected) tabBar.syncSelected();
    }
    this.loadAdminData();
  },

  async loadAdminData() {
    try {
      const [demandRes, timeoutRes, staffRes, areaRes] = await Promise.all([
        getDemandList({ pageSize: 1 }),
        getTimeoutList({ pageSize: 1 }),
        getStaffConfig(),
        getAreaConfigList().catch(() => ({ data: { list: [] } }))
      ]);
      this.setData({
        stats: demandRes.data.stats || this.data.stats,
        timeoutCount: timeoutRes.data.total || 0,
        staffCount: staffRes.data.total || 0,
        areaConfigCount: (areaRes.data.list || []).length
      });
    } catch {}
  },

  onNavTo(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) {
      console.error('onNavTo: url is empty');
      return;
    }
    wx.navigateTo({ url });
  }
});
