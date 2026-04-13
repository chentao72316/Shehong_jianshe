const { ROLES } = require('../../utils/constants');
const { getDemandList, getMessageList, getAnnouncementList, getPendingList } = require('../../utils/api');
const { formatDate } = require('../../utils/time');

Page({
  data: {
    currentRole: '',
    currentRoleLabel: '',
    roleTag: '',
    userInfo: null,
    // 快捷入口（根据角色动态生成）
    shortcuts: [],
    // 统计概览（根据角色动态配置标签）
    stats: {
      total: 0,
      inProgress: 0,
      timeout: 0,
      done: 0
    },
    // 统计配置（根据角色变化的标签和颜色）
    statsConfig: [],
    // 统计区域标题
    statsTitle: '工单概览',
    // 待办列表（根据角色动态显示）
    pendingList: [],
    // 待办列表标题
    pendingTitle: '进行中的需求',
    // 走马灯消息列表
    marqueeItems: [],
    marqueeIndex: 0
  },

  onLoad() {
    this.refreshRoleState();
  },

  refreshRoleState() {
    const app = getApp();
    const currentRole = app.globalData.currentRole || wx.getStorageSync('currentRole') || '';
    const userInfo = app.globalData.userInfo;
    const roleLabel = ROLES[currentRole] || currentRole;
    const parts = [userInfo?.area, userInfo?.gridName, roleLabel].filter(Boolean);
    const roleTag = parts.join('/');
    this.setData({
      currentRole,
      currentRoleLabel: roleLabel,
      roleTag,
      userInfo,
      shortcuts: this.buildShortcuts(currentRole),
      statsConfig: this.buildStatsConfig(currentRole),
      statsTitle: this.buildStatsTitle(currentRole),
      pendingTitle: this.buildPendingTitle(currentRole)
    });
  },

  onShow() {
    this.refreshRoleState();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      const tabBar = this.getTabBar();
      // 刷新 Tab 列表（切换角色后 Tab2 可能已变化）
      if (tabBar.refreshTabs) {
        tabBar.refreshTabs();
      }
      // 自动同步高亮
      if (tabBar.syncSelected) {
        tabBar.syncSelected();
      }
    }
    this.loadStats();
    this.loadMarqueeItems();
  },

  // 根据角色构建快捷入口
  buildShortcuts(role) {
    const map = {
      FRONTLINE: [
        { label: '新建工单', icon: '📝', url: '/pages/demand-create/demand-create' },
        { label: '我的工单', icon: '📋', url: '/pages/demand-list/demand-list' }
      ],
      DISTRICT_MANAGER: [
        { label: '待审核', icon: '📌', url: '/pages/demand-list/demand-list?status=待审核' },
        { label: '超时督办', icon: '⏰', url: '/pages/timeout-list/timeout-list' },
        { label: '统计', icon: '📊', url: '/pages/statistics/statistics' }
      ],
      DEPT_MANAGER: [
        { label: '全部需求', icon: '📋', url: '/pages/demand-list/demand-list' },
        { label: '超时督办', icon: '⏰', url: '/pages/timeout-list/timeout-list' },
        { label: '统计', icon: '📊', url: '/pages/statistics/statistics' }
      ],
      LEVEL4_MANAGER: [
        { label: '全部需求', icon: '📋', url: '/pages/demand-list/demand-list' },
        { label: '超时督办', icon: '⏰', url: '/pages/timeout-list/timeout-list' },
        { label: '统计', icon: '📊', url: '/pages/statistics/statistics' }
      ],
      GRID_MANAGER: [
        { label: '待审核', icon: '🔍', url: '/pages/demand-list/demand-list?status=待审核' },
        { label: '超时督办', icon: '⏰', url: '/pages/timeout-list/timeout-list' },
        { label: '统计', icon: '📊', url: '/pages/statistics/statistics' }
      ],
      NETWORK_MANAGER: [
        { label: '全部需求', icon: '📋', url: '/pages/demand-list/demand-list' },
        { label: '超时督办', icon: '⏰', url: '/pages/timeout-list/timeout-list' },
        { label: '统计', icon: '📊', url: '/pages/statistics/statistics' }
      ],
      DESIGN: [
        { label: '我的任务', icon: '📐', url: '/pages/design-task/design-task' }
      ],
      CONSTRUCTION: [
        { label: '我的任务', icon: '🔧', url: '/pages/construction-task/construction-task' }
      ],
      SUPERVISOR: [
        { label: '监理任务', icon: '🔍', url: '/pages/supervisor-task/supervisor-task' }
      ],
      ADMIN: [
        { label: '全部需求', icon: '📋', url: '/pages/demand-list/demand-list' },
        { label: '人员配置', icon: '👥', url: '/pages/staff-config/staff-config' },
        { label: '管理后台', icon: '⚙️', url: '/pages/admin/admin' }
      ]
    };
    return map[role] || [];
  },

  // 根据角色构建统计配置（标签名 + 颜色类）
  buildStatsConfig(role) {
    const configs = {
      FRONTLINE: [
        { key: 'total',        label: '总需求',  colorClass: '' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',        label: '已完成',  colorClass: 'text-success' }
      ],
      DESIGN: [
        { key: 'designing',    label: '设计中',  colorClass: 'text-info' },
        { key: 'constructing', label: '已提交',  colorClass: 'text-info' },
        { key: 'done',         label: '已开通',  colorClass: 'text-success' },
        { key: 'timeout',      label: '已超时',  colorClass: 'text-danger' }
      ],
      CONSTRUCTION: [
        { key: 'constructing',   label: '施工中',  colorClass: 'text-info' },
        { key: 'waitingConfirm', label: '待确认',  colorClass: 'text-warning' },
        { key: 'done',           label: '已开通',  colorClass: 'text-success' },
        { key: 'timeout',        label: '已超时',  colorClass: 'text-danger' }
      ],
      SUPERVISOR: [
        { key: 'constructing',   label: '施工中',  colorClass: 'text-info' },
        { key: 'waitingConfirm', label: '待确认',  colorClass: 'text-warning' },
        { key: 'done',           label: '已开通',  colorClass: 'text-success' },
        { key: 'timeout',        label: '已超时',  colorClass: 'text-danger' }
      ],
      GRID_MANAGER: [
        { key: 'pending',    label: '待指派',  colorClass: 'text-warning' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',       label: '已完成',  colorClass: 'text-success' }
      ],
      NETWORK_MANAGER: [
        { key: 'pending',    label: '待确认',  colorClass: 'text-warning' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',       label: '已完成',  colorClass: 'text-success' }
      ],
      DISTRICT_MANAGER: [
        { key: 'total',      label: '总需求',  colorClass: '' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',       label: '已完成',  colorClass: 'text-success' }
      ],
      DEPT_MANAGER: [
        { key: 'total',      label: '总需求',  colorClass: '' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',       label: '已完成',  colorClass: 'text-success' }
      ],
      LEVEL4_MANAGER: [
        { key: 'total',      label: '总需求',  colorClass: '' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',       label: '已完成',  colorClass: 'text-success' }
      ],
      ADMIN: [
        { key: 'total',      label: '总需求',  colorClass: '' },
        { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
        { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
        { key: 'done',       label: '已完成',  colorClass: 'text-success' }
      ]
    };
    return configs[role] || [
      { key: 'total',      label: '总需求',  colorClass: '' },
      { key: 'inProgress', label: '进行中',  colorClass: 'text-info' },
      { key: 'timeout',    label: '已超时',  colorClass: 'text-danger' },
      { key: 'done',       label: '已完成',  colorClass: 'text-success' }
    ];
  },

  // 构建统计区域标题
  buildStatsTitle(role) {
    const titles = {
      FRONTLINE:         '我的工单动态',
      DESIGN:            '设计动态',
      CONSTRUCTION:      '施工动态',
      SUPERVISOR:        '监理动态',
      GRID_MANAGER:      '网格动态',
      NETWORK_MANAGER:   '待确认工单',
      DISTRICT_MANAGER: '全县区动态',
      DEPT_MANAGER:      '全公司动态',
      LEVEL4_MANAGER:    '全局工单动态',
      ADMIN:             '系统概览'
    };
    return titles[role] || '工单概览';
  },

  // 构建待办列表标题
  buildPendingTitle(role) {
    const titles = {
      FRONTLINE:         '进行中的需求',
      DESIGN:            '待处理任务',
      CONSTRUCTION:      '施工中任务',
      SUPERVISOR:        '待处理任务',
      GRID_MANAGER:      '待指派工单',
      NETWORK_MANAGER:   '待确认工单',
      DISTRICT_MANAGER:  '进行中超时工单',
      DEPT_MANAGER:      '进行中超时工单',
      LEVEL4_MANAGER:    '进行中超时工单',
      ADMIN:             '进行中超时工单'
    };
    return titles[role] || '待办事项';
  },

  async loadStats() {
    try {
      const [listRes, pendingRes] = await Promise.allSettled([
        getDemandList({ pageSize: 1, page: 1 }),
        getPendingList()
      ]);
      if (listRes.status === 'fulfilled' && listRes.value?.data?.stats) {
        this.setData({ stats: listRes.value.data.stats });
      }
      if (pendingRes.status === 'fulfilled') {
        const items = (pendingRes.value?.data?.list || []).map(d => ({
            id: d.id || String(d._id),
            demandNo: d.demandNo,
            type: d.type,
            businessType: d.businessType || '',
            acceptArea: d.acceptArea,
            location: d.locationDetail || '',
            status: d.status,
            urgency: d.urgency,
            submitter: d.createdBy?.name ? `${d.createdBy.name} ${d.createdBy.phone || ''}` : (d.createdBy?.phone || ''),
            createdAt: formatDate(d.createdAt),
            timeoutDays: d.timeoutDays,
            remainingDays: d.remainingDays
          }));
        this.setData({ pendingList: items });
      }
    } catch {
      // 统计加载失败不影响主流程
    }
  },

  // 加载走马灯：公告优先 + 最新5条站内消息
  async loadMarqueeItems() {
    try {
      const [annRes, msgRes] = await Promise.allSettled([
        getAnnouncementList(),
        getMessageList({ page: 1, pageSize: 5 })
      ]);

      const items = [];

      if (annRes.status === 'fulfilled') {
        const announcements = annRes.value?.data || [];
        announcements.forEach(a => items.push({
          id: a._id,
          text: a.title,
          type: 'announcement',
          content: a.content
        }));
      }

      if (msgRes.status === 'fulfilled') {
        const msgs = msgRes.value?.data?.list || [];
        msgs.forEach(m => items.push({
          id: m._id,
          text: m.title,
          type: 'message',
          demandId: m.demandId,
          msgId: m._id
        }));
      }

      this.setData({ marqueeItems: items, marqueeIndex: 0 });
    } catch {
      // 走马灯加载失败不影响主流程
    }
  },

  onTapPendingDemand(e) {
    const id = e.detail?.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${id}` });
  },

  onTapShortcut(e) {
    const { url } = e.currentTarget.dataset;
    if (!url) {
      console.error('onTapShortcut: url is empty');
      return;
    }
    // 分离路径和查询参数
    const [path, query] = url.split('?');
    const tabBarPages = [
      '/pages/home/home',
      '/pages/demand-list/demand-list',
      '/pages/design-task/design-task',
      '/pages/construction-task/construction-task',
      '/pages/supervisor-task/supervisor-task',
      '/pages/admin/admin',
      '/pages/message-list/message-list',
      '/pages/profile/profile'
    ];
    if (tabBarPages.includes(path)) {
      // switchTab 不支持 query params，通过 globalData 中转筛选条件
      if (query) {
        const params = Object.fromEntries(query.split('&').map(p => p.split('=')));
        getApp().globalData.pendingFilter = params;
      }
      wx.switchTab({ url: path });
    } else {
      wx.navigateTo({ url });
    }
  },

  // 点击走马灯条目
  onTapMarquee(e) {
    const item = e.currentTarget.dataset.item;
    if (!item) return;
    if (item.type === 'announcement') {
      wx.navigateTo({ url: `/pages/announcement-detail/announcement-detail?id=${item.id}` });
    } else if (item.type === 'message' && item.demandId) {
      wx.navigateTo({ url: `/pages/demand-detail/demand-detail?id=${item.demandId}` });
    }
  }
});
