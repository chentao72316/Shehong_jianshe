const { getGridStats, getAreaStats } = require('../../utils/api');

Page({
  data: {
    currentRole: '',
    gridStats: [],
    areaStats: [],
    loading: false,
    // 时间范围筛选
    timeRange: 'month',  // week/month/quarter/year
    timeRangeIndex: 1,   // timeRangeOptions 中当前选中项的索引
    timeRangeOptions: [
      { label: '本周', value: 'week' },
      { label: '本月', value: 'month' },
      { label: '本季', value: 'quarter' },
      { label: '全年', value: 'year' }
    ]
  },

  onLoad() {
    const app = getApp();
    this.setData({ currentRole: app.globalData.currentRole });
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  async loadStats() {
    this.setData({ loading: true });
    try {
      const params = { timeRange: this.data.timeRange };
      const [gridRes, areaRes] = await Promise.all([
        getGridStats(params),
        getAreaStats(params)
      ]);
      this.setData({
        gridStats: gridRes.data.list || [],
        areaStats: areaRes.data.list || [],
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onTimeRangeChange(e) {
    const index = e.detail.value;
    const value = this.data.timeRangeOptions[index].value;
    this.setData({ timeRange: value, timeRangeIndex: index });
    this.loadStats();
  }
});
