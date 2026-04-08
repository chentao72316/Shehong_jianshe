/* 状态 → 丝带颜色 & 短标签映射 */
const RIBBON_MAP = {
  '待审核': { color: '#FA8C16', textColor: '#fff', label: '待审核' },
  '设计中': { color: '#1890FF', textColor: '#fff', label: '设计中' },
  '施工中': { color: '#096DD9', textColor: '#fff', label: '施工中' },
  '待确认': { color: '#722ED1', textColor: '#fff', label: '待确认' },
  '已开通': { color: '#52C41A', textColor: '#fff', label: '已开通' },
  '已驳回': { color: '#F5222D', textColor: '#fff', label: '已驳回' }
};

Component({
  properties: {
    demand: {
      type: Object,
      value: {}
    }
  },
  data: {
    ribbonColor: '#8C8C8C',
    ribbonTextColor: '#fff',
    ribbonLabel: '-'
  },
  observers: {
    'demand.status': function (status) {
      const info = RIBBON_MAP[status] || { color: '#8C8C8C', textColor: '#fff', label: status || '-' };
      this.setData({ ribbonColor: info.color, ribbonTextColor: info.textColor, ribbonLabel: info.label });
    }
  },
  methods: {
    onTap() {
      this.triggerEvent('tap', { id: this.properties.demand.id });
    }
  }
});
