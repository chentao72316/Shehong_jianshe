const { getMessageList, markMessageRead } = require('../../utils/api');
const { formatTime } = require('../../utils/time');

Page({
  data: {
    messages: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    unreadCount: 0
  },

  onLoad() {
    this.loadMessages(true);
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      if (tabBar.refreshTabs) tabBar.refreshTabs();
      if (tabBar.syncSelected) tabBar.syncSelected();
    }
    this.loadMessages(true);
  },

  async loadMessages(reset = false) {
    if (this.data.loading) return;
    if (reset) this.setData({ page: 1, messages: [], hasMore: true });
    if (!this.data.hasMore && !reset) return;

    this.setData({ loading: true });
    try {
      const res = await getMessageList({ page: this.data.page, pageSize: this.data.pageSize });
      const messages = res.data.list.map(item => ({
        ...item,
        timeStr: formatTime(item.createdAt)
      }));
      this.setData({
        messages: reset ? messages : [...this.data.messages, ...messages],
        unreadCount: res.data.unreadCount || 0,
        hasMore: messages.length === this.data.pageSize,
        page: this.data.page + 1,
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  async onTapMessage(e) {
    const { id, demandId, read, type } = e.currentTarget.dataset;
    if (!read) {
      await markMessageRead({ id });
    }
    if (type === 'system') {
      // demandNo 字段存的是公告 ID（服务端创建时写入）
      const annId = e.currentTarget.dataset.demandNo;
      if (annId) {
        wx.navigateTo({ url: `/pages/announcement-detail/announcement-detail?id=${annId}` });
      }
      return;
    }
    if (demandId) {
      wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${demandId}` });
    }
  },

  onReachBottom() {
    this.loadMessages(false);
  },

  onPullDownRefresh() {
    this.loadMessages(true).then(() => wx.stopPullDownRefresh());
  }
});
