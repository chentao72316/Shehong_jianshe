// SVG 图标（URL-encoded data URI，无需外部文件）
const ICON_GRAY  = '%238C8C8C';
const ICON_GREEN = '%231E6F3F';

function svg(fill, path) {
  return "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270,0,24,24%27%20fill=%27" + fill + "%27%3E%3Cpath%20d=%27" + path.replace(/ /g, '%20') + "%27/%3E%3C/svg%3E";
}

// Material Design 标准路径（坐标用逗号分隔，无空格）
const PATH_HOME    = 'M10,20v-6h4v6h5v-8h3L12,3L2,12h3v8z';
const PATH_ORDER   = 'M3,18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z';
const PATH_MESSAGE = 'M20,2H4c-1.1,0-2,.9-2,2v18l4-4h14c1.1,0,2-.9,2-2V4c0-1.1-.9-2-2-2z';
const PATH_PROFILE = 'M12,4a4,4,0,1,0,4,4A4,4,0,0,0,12,4zm0,10c-4,0-8,2-8,4v2h16v-2c0-2-4-4-8-4z';
// 任务/指派图标
const PATH_TASK    = 'M19,3H5C3.9,3,3,3.9,3,5v14c0,1.1,0.9,2,2,2h14c1.1,0,2-0.9,2-2V5C21,3.9,20.1,3,19,3z M12,3c0.55,0,1,0.45,1,1s-0.45,1-1,1s-1-0.45-1-1S11.45,3,12,3z M14,17H7v-2h7V17z M17,13H7v-2h10V13z M17,9H7V7h10V9z';
// 验收/确认图标
const PATH_VERIFY  = 'M12,2C6.48,2,2,6.48,2,12s4.48,10,10,10s10-4.48,10-10S17.52,2,12,2z M10,17l-5-5l1.41-1.41L10,14.17l7.59-7.59L19,8L10,17z';
// 管理/设置图标（齿轮）
const PATH_ADMIN   = 'M12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49,1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506,0,0,0,14,2h-4c-.25,0-.46.18-.5.42l-.37,2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49,0-.61.22l-2,3.46c-.13.22-.07.49.12.64L4.57,11c-.04.34-.07.67-.07,1s.03.65.07.97l-2.11,1.66c-.19.15-.25.42-.12.64l2,3.46c.12.22.39.3.61.22l2.49-1.01c.52.4,1.06.74,1.69.99l.37,2.65c.04.24.25.42.5.42h4c.25,0,.46-.18.5-.42l.37-2.65c.63-.26,1.17-.59,1.69-.99l2.49,1.01c.22.08.49,0,.61-.22l2-3.46c.12-.22.07-.49-.12-.64Z';

// Tab2 按角色变化的图标
const ICON_TASK   = { normal: svg(ICON_GRAY, PATH_TASK),   active: svg(ICON_GREEN, PATH_TASK)   };
const ICON_VERIFY = { normal: svg(ICON_GRAY, PATH_VERIFY), active: svg(ICON_GREEN, PATH_VERIFY) };
const ICON_ADMIN  = { normal: svg(ICON_GRAY, PATH_ADMIN),  active: svg(ICON_GREEN, PATH_ADMIN)  };
const ICON_ORDER  = { normal: svg(ICON_GRAY, PATH_ORDER),  active: svg(ICON_GREEN, PATH_ORDER)  };

// 各角色 Tab2 配置
const TAB2_CONFIG = {
  DESIGN:       { text: '任务', pagePath: '/pages/design-task/design-task',       icon: ICON_TASK   },
  CONSTRUCTION: { text: '任务', pagePath: '/pages/construction-task/construction-task', icon: ICON_TASK },
  SUPERVISOR:   { text: '验收', pagePath: '/pages/supervisor-task/supervisor-task',    icon: ICON_VERIFY },
  ADMIN:        { text: '管理', pagePath: '/pages/admin/admin',                  icon: ICON_ADMIN  }
};

// 默认 Tab2：工单
const DEFAULT_TAB2 = { text: '工单', pagePath: '/pages/demand-list/demand-list', icon: ICON_ORDER };

// 公共 Tab（Tab1/Tab3/Tab4）
const COMMON_TABS = [
  { text: '首页', pagePath: '/pages/home/home' },
  { text: '消息', pagePath: '/pages/message-list/message-list' },
  { text: '我的', pagePath: '/pages/profile/profile' }
];

// 根据角色构建 4 个 Tab 的完整列表
function getTabList(role) {
  const tab2 = TAB2_CONFIG[role] || DEFAULT_TAB2;
  return [
    { ...COMMON_TABS[0] },
    { ...tab2 },
    { ...COMMON_TABS[1] },
    { ...COMMON_TABS[2] }
  ];
}

// 根据当前页面路径查找对应的 tab 索引
// 遍历当前角色的 tabList，找到 pagePath 匹配当前页面路径的 tab
function getSelectedIndex(tabList, currentPath) {
  for (let i = 0; i < tabList.length; i++) {
    if (tabList[i].pagePath === currentPath) {
      return i;
    }
  }
  return 0; // 默认回到首页
}

// 更新所有 Tab 的图标（高亮当前选中的）
function updateIconUrls(tabs, selected) {
  return tabs.map((tab, i) => ({
    ...tab,
    iconUrl: i === selected ? getActiveIcon(i) : getNormalIcon(i)
  }));
}

// 获取指定索引的 active 图标
function getActiveIcon(index) {
  if (index === 0) return svg(ICON_GREEN, PATH_HOME);
  if (index === 1) {
    const role = wx.getStorageSync('currentRole') || '';
    const tab2 = TAB2_CONFIG[role] || DEFAULT_TAB2;
    return tab2.icon.active;
  }
  if (index === 2) return svg(ICON_GREEN, PATH_MESSAGE);
  if (index === 3) return svg(ICON_GREEN, PATH_PROFILE);
  return '';
}

// 获取指定索引的 normal 图标
function getNormalIcon(index) {
  if (index === 0) return svg(ICON_GRAY, PATH_HOME);
  if (index === 1) {
    const role = wx.getStorageSync('currentRole') || '';
    const tab2 = TAB2_CONFIG[role] || DEFAULT_TAB2;
    return tab2.icon.normal;
  }
  if (index === 2) return svg(ICON_GRAY, PATH_MESSAGE);
  if (index === 3) return svg(ICON_GRAY, PATH_PROFILE);
  return '';
}

Component({
  data: {
    selected: 0,
    tabs: []
  },

  lifetimes: {
    attached() {
      this._init();
    }
  },

  methods: {
    _init() {
      const role = wx.getStorageSync('currentRole') || '';
      const tabList = getTabList(role);
      // 初始化时默认选中首页（index=0）
      const tabs = updateIconUrls(tabList, 0);
      this.setData({ tabs, selected: 0 });
    },

    // 切换角色后调用此方法重建 Tab 列表
    refreshTabs() {
      this._init();
    },

    // 自动同步高亮：根据当前页面路径自动找到对应 tab
    syncSelected() {
      const pages = getCurrentPages();
      if (pages.length === 0) return;
      const currentPage = pages[pages.length - 1];
      const currentPath = '/' + currentPage.route;
      const role = wx.getStorageSync('currentRole') || '';
      const tabList = getTabList(role);
      const idx = getSelectedIndex(tabList, currentPath);

      if (idx !== this.data.selected) {
        const tabs = updateIconUrls(tabList, idx);
        this.setData({ tabs, selected: idx });
      }
    },

    onTap(e) {
      const index = e.currentTarget.dataset.index;
      if (index === this.data.selected) return;

      const role = wx.getStorageSync('currentRole') || '';
      const tabList = getTabList(role);
      const url = tabList[index].pagePath;

      // 更新高亮
      const tabs = updateIconUrls(tabList, index);
      this.setData({ tabs, selected: index });

      // 尝试 switchTab，失败后尝试 navigateTo
      wx.switchTab({ url }).catch(() => {
        wx.navigateTo({ url });
      });
    },

    onTapAsk() {
      wx.navigateTo({ url: '/pages/ask/ask' });
    }
  }
});
