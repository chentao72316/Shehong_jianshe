const { getTimeoutList, sendRemind, setAutoReminderMute } = require('../../utils/api');
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
        const timeoutStartTime = item.timeoutStartTime || item.createdAt;
        const timeoutDays = Number.isFinite(Number(item.timeoutDays))
          ? Number(item.timeoutDays)
          : calcDaysDiff(timeoutStartTime);
        return {
          ...item,
          timeoutDays,
          createdAt: formatDate(item.createdAt),
          timeoutStartAt: formatDate(timeoutStartTime),
          submitter: item.createdBy?.name ? `${item.createdBy.name} ${item.createdBy.phone || ''}` : (item.createdBy?.phone || ''),
          location: item.locationDetail || '',
          muteLabel: item.muted ? '已停止督办' : '督办中',
          muteButtonText: item.muted ? '恢复督办' : '停止督办'
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
    const { id, eventType } = e.currentTarget.dataset;
    wx.showModal({
      title: '发送督办提醒',
      content: '将通过飞书发送督办提醒，确认？',
      success: async (res) => {
        if (res.confirm) {
          await sendRemind({ demandId: id, eventType });
          wx.showToast({ title: '提醒已发送', icon: 'success' });
        }
      }
    });
  },

  onToggleMute(e) {
    const { id, eventType, muted } = e.currentTarget.dataset;
    const currentMuted = muted === true || muted === 'true';
    const nextMuted = !currentMuted;
    wx.showModal({
      title: nextMuted ? '停止督办' : '恢复督办',
      content: nextMuted ? '确认停止该类型的系统自动督办吗？人工提醒仍可发送。' : '确认恢复该类型的系统自动督办吗？',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await setAutoReminderMute({ demandId: id, eventType, muted: nextMuted });
          wx.showToast({ title: nextMuted ? '已停止督办' : '已恢复督办', icon: 'success' });
          this.loadList(true);
        } catch {}
      }
    });
  },

  onTapItem(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${id}` });
  }
});
