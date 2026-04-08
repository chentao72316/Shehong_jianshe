const { STATUS_COLORS } = require('../../utils/constants');

Component({
  properties: {
    status: {
      type: String,
      value: ''
    }
  },
  computed: {
    // 不支持computed，在observer中处理
  },
  observers: {
    'status': function(status) {
      const safeStatus = status == null ? '' : status;
      const color = STATUS_COLORS[safeStatus] || '#8C8C8C';
      this.setData({ color });
    }
  },
  data: {
    color: '#8C8C8C'
  },
  methods: {}
});
