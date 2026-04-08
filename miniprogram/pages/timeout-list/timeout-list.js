const { getTimeoutList, sendRemind } = require('../../utils/api');
const { formatDate, calcDaysDiff } = require('../../utils/time');

Page({
  data: {
    list: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    currentRole: ''
  },

  onLoad() {
    const app = getApp();
    this.setData({ currentRole: app.globalData.currentRole });
    this.loadList(true);
  },

  onShow() {
    this.loadList(true);
  },

  async loadList(reset = false) {
    if (this.data.loading) return;
    if (reset) this.setData({ page: 1, list: [], hasMore: true });
    if (!this.data.hasMore && !reset) return;

    this.setData({ loading: true });
    try {
      const res = await getTimeoutList({ page: this.data.page, pageSize: this.data.pageSize });
      const list = res.data.list.map(item => {
        // 根据当前状态选择计时起点
        let timeoutStartTime;
        if (item.status === '设计中') {
          timeoutStartTime = item.designAssignTime;
        } else if (item.status === '施工中') {
          timeoutStartTime = item.constructionAssignTime;
        } else {
          timeoutStartTime = item.createdAt;
        }
        return {
          ...item,
          timeoutDays: calcDaysDiff(timeoutStartTime),
          createdAt: formatDate(item.createdAt),
          submitter: item.createdBy?.name ? `${item.createdBy.name} ${item.createdBy.phone || ''}` : (item.createdBy?.phone || ''),
          location: item.locationDetail || ''
        };
      });
      this.setData({
        list: reset ? list : [...this.data.list, ...list],
        hasMore: list.length === this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  onReachBottom() {
    this.loadList(false);
  },

  onPullDownRefresh() {
    this.loadList(true).then(() => wx.stopPullDownRefresh());
  },

  // 发送飞书提醒
  async onSendRemind(e) {
    const { id } = e.currentTarget.dataset;
    wx.showModal({
      title: '发送督办提醒',
      content: '将通过飞书发送督办提醒，确认？',
      success: async (res) => {
        if (res.confirm) {
          await sendRemind({ demandId: id });
          wx.showToast({ title: '提醒已发送', icon: 'success' });
        }
      }
    });
  },

  onTapItem(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${id}` });
  }
});
