// 需求状态
const DEMAND_STATUS = {
  PENDING_REVIEW: '待审核',
  DESIGNING: '设计中',
  CONSTRUCTING: '施工中',
  WAIT_CONFIRM: '待确认',
  OPENED: '已开通',
  REJECTED: '已驳回'
};

// 需求类型
const DEMAND_TYPES = ['新建', '扩容', '改造', '应急'];

// 紧急程度
const URGENCY_LEVELS = ['普通', '紧急', '特急'];

// 角色
const ROLES = {
  FRONTLINE: '一线人员',
  DISTRICT_MANAGER: '区县经理',
  DEPT_MANAGER: '部门经理',
  LEVEL4_MANAGER: '四级经理',
  DESIGN: '设计',
  CONSTRUCTION: '施工',
  SUPERVISOR: '监理',
  ADMIN: '管理员',
  // 兼容旧角色
  GRID_MANAGER: '网格经理',
  NETWORK_MANAGER: '网络支撑经理'
};

// 进度百分比
const STATUS_PROGRESS = {
  '待审核': 10,
  '设计中': 30,
  '施工中': 70,
  '待确认': 90,
  '已开通': 100,
  '已驳回': -1
};

// 状态颜色
const STATUS_COLORS = {
  '待审核': '#FA8C16',
  '设计中': '#1890FF',
  '施工中': '#096DD9',
  '待确认': '#722ED1',
  '已开通': '#52C41A',
  '已驳回': '#F5222D'
};

// 工单流程步骤定义 - 普通流程
const DEMAND_STEPS = [
  { key: 'design',       label: '设计',     statuses: ['设计中'] },
  { key: 'construction', label: '施工',     statuses: ['施工中'] },
  { key: 'confirm',      label: '开通确认', statuses: ['待确认'] },
  { key: 'completed',    label: '已开通',   statuses: ['已开通'] }
];

// 工单流程步骤定义 - 跨区域流程（跨区审核插在提交与设计之间）
const DEMAND_STEPS_CROSS_AREA = [
  { key: 'review',       label: '跨区审核', statuses: ['待审核'] },
  { key: 'design',       label: '设计',     statuses: ['设计中'] },
  { key: 'construction', label: '施工',     statuses: ['施工中'] },
  { key: 'confirm',      label: '开通确认', statuses: ['待确认'] },
  { key: 'completed',    label: '已开通',   statuses: ['已开通'] }
];

// 工单流程步骤定义 - 有现有资源流程（无施工步骤，设计后直接开通确认）
const DEMAND_STEPS_HAS_RESOURCE = [
  { key: 'design',    label: '设计',     statuses: ['设计中'] },
  { key: 'confirm',   label: '开通确认', statuses: ['待确认'] },
  { key: 'completed', label: '已开通',   statuses: ['已开通'] }
];

// 工单流程步骤定义 - 跨区域 + 有现有资源
const DEMAND_STEPS_CROSS_AREA_HAS_RESOURCE = [
  { key: 'review',    label: '跨区审核', statuses: ['待审核'] },
  { key: 'design',    label: '设计',     statuses: ['设计中'] },
  { key: 'confirm',   label: '开通确认', statuses: ['待确认'] },
  { key: 'completed', label: '已开通',   statuses: ['已开通'] }
];

// 资管生效状态
const ASSET_STATUS = ['已生效', '待生效', '未生效'];

module.exports = {
  DEMAND_STATUS,
  DEMAND_TYPES,
  URGENCY_LEVELS,
  ROLES,
  STATUS_PROGRESS,
  STATUS_COLORS,
  ASSET_STATUS,
  DEMAND_STEPS,
  DEMAND_STEPS_CROSS_AREA,
  DEMAND_STEPS_HAS_RESOURCE,
  DEMAND_STEPS_CROSS_AREA_HAS_RESOURCE
};
