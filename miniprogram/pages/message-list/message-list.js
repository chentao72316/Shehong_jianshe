const {
  getMessageList,
  markMessageRead,
  archiveMessage,
  archiveAllMessages
} = require('../../utils/api');
const { formatTime } = require('../../utils/time');

Page({
  data: {
    messages: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    unreadCount: 0,
    clearableCount: 0
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
        id: item.id || item._id,
        demandId: item.demandId || '',
        announcementId: item.announcementId || '',
        timeStr: formatTime(item.createdAt)
      }));
      const mergedMessages = reset ? messages : [...this.data.messages, ...messages];
      this.setData({
        messages: mergedMessages,
        unreadCount: res.data.unreadCount || 0,
        hasMore: messages.length === this.data.pageSize,
        page: this.data.page + 1,
        clearableCount: mergedMessages.filter(item => item.type !== 'system').length,
        loading: false
      });
    } catch {
      this.setData({ loading: false });
    }
  },

  async onTapMessage(e) {
    const { id, demandId, demandNo, announcementId, read, type } = e.currentTarget.dataset;
    try {
      if (!read) {
        await markMessageRead({ id });
      }
    } catch {
      wx.showToast({ title: '消息状态更新失败', icon: 'none' });
      return;
    }

    if (type === 'system') {
      if (!read) {
        this.setData({
          messages: this.data.messages.map(item => (item.id === id ? { ...item, read: true } : item)),
          unreadCount: Math.max(0, this.data.unreadCount - 1)
        });
      }
      const targetAnnouncementId = announcementId || demandNo;
      if (targetAnnouncementId) {
        wx.navigateTo({ url: `/pages/announcement-detail/announcement-detail?id=${targetAnnouncementId}` });
      }
      return;
    }

    try {
      await archiveMessage({ id });
    } catch {
      wx.showToast({ title: '消息归档失败', icon: 'none' });
      return;
    }

    const remainingMessages = this.data.messages.filter(item => item.id !== id);
    this.setData({
      messages: remainingMessages,
      unreadCount: read ? this.data.unreadCount : Math.max(0, this.data.unreadCount - 1),
      clearableCount: remainingMessages.filter(item => item.type !== 'system').length
    });

    if (demandId) {
      wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${demandId}` });
    }
  },

  onTapClear() {
    if (!this.data.clearableCount) return;

    wx.showModal({
      title: '清空非公告消息',
      content: '将清空当前账号所有非公告消息，公告会保留。',
      confirmText: '清空',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '清理中...' });
        try {
          await archiveAllMessages();
          await this.loadMessages(true);
          wx.showToast({ title: '已清空', icon: 'success' });
        } catch {
          wx.showToast({ title: '清空失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  onReachBottom() {
    this.loadMessages(false);
  },

  onPullDownRefresh() {
    this.loadMessages(true).then(() => wx.stopPullDownRefresh());
  }
});
