const { getAnnouncementDetail } = require('../../utils/api');

Page({
  data: {
    loading: true,
    announcement: null,
    publishTime: '',
    endTime: ''
  },

  async onLoad(options) {
    const { id } = options;
    if (!id) {
      this.setData({ loading: false });
      return;
    }
    try {
      const res = await getAnnouncementDetail(id);
      const ann = res?.data;
      if (ann) {
        this.setData({
          announcement: ann,
          publishTime: this.fmtDate(ann.startTime || ann.createdAt),
          endTime: ann.endTime ? this.fmtDate(ann.endTime) : '',
          loading: false
        });
        wx.setNavigationBarTitle({ title: ann.title });
      } else {
        this.setData({ loading: false });
      }
    } catch {
      this.setData({ loading: false });
    }
  },

  fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }
});
