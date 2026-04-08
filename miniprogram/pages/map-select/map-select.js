Page({
  data: {
    latitude: 30.0,
    longitude: 104.0,
    markers: [],
    scale: 16
  },

  onLoad(options) {
    if (options.lat && options.lng) {
      const lat = parseFloat(options.lat);
      const lng = parseFloat(options.lng);
      this.setData({
        latitude: lat,
        longitude: lng,
        markers: [{ id: 1, latitude: lat, longitude: lng }]
      });
    }
  },

  onMapTap(e) {
    const { latitude, longitude } = e.detail;
    this.setData({
      latitude,
      longitude,
      markers: [{ id: 1, latitude, longitude }]
    });
  },

  onConfirm() {
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    prevPage.setData({
      'form.latitude': this.data.latitude,
      'form.longitude': this.data.longitude
    });
    wx.navigateBack();
  }
});
