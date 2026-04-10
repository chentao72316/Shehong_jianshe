const { request } = require('./request');

// 认证
const login = (data) => request({ url: '/api/login', method: 'POST', data });
const phonePasswordLogin = (phone, password) => request({ url: '/api/auth/phone-password', method: 'POST', data: { phone, password } });
const wxBind = (loginCode) => request({ url: '/api/auth/wx-bind', method: 'POST', data: { loginCode } });
const bindPhone = (bindToken, phone, password) => request({ url: '/api/auth/bind-phone', method: 'POST', data: { bindToken, phone, password } });
const changePassword = (oldPassword, newPassword) => request({ url: '/api/auth/change-password', method: 'POST', data: { oldPassword, newPassword } });
const getUserRole = () => request({ url: '/api/user/role', method: 'GET' });

// 需求
const createDemand = (data) => request({ url: '/api/demand/create', method: 'POST', data });
const updateDemand = (data) => request({ url: '/api/demand/update', method: 'POST', data });
const getDemandList = (params) => request({ url: '/api/demand/list', method: 'GET', data: params });
const getDemandDetail = (id) => request({ url: '/api/demand/detail', method: 'GET', data: { id } });
const getPendingList = () => request({ url: '/api/demand/pending', method: 'GET' });
const rejectDemand = (data) => request({ url: '/api/demand/reject', method: 'POST', data: { demandId: data.id, reason: data.reason } });
const crossAreaReview = (data) => request({ url: '/api/demand/cross-area-review', method: 'POST', data });
const acknowledgeRejection = (demandId) => request({ url: '/api/demand/acknowledge-rejection', method: 'POST', data: { demandId } });

// 设计
const submitDesign = (data) => request({ url: '/api/design/submit', method: 'POST', data });

// 施工
const startConstruction = (data) => request({ url: '/api/construction/start', method: 'POST', data });
const submitConstruction = (data) => request({ url: '/api/construction/submit', method: 'POST', data });

// 超时督办
const getTimeoutList = (params) => request({ url: '/api/timeout/list', method: 'GET', data: params });
const sendRemind = (data) => request({ url: '/api/timeout/remind', method: 'POST', data });

// 流程干预
const forceStatus = (data) => request({ url: '/api/intervene/force-status', method: 'POST', data: { demandId: data.id, status: data.status, reason: data.reason } });
const addRemark = (data) => request({ url: '/api/intervene/remark', method: 'POST', data: { demandId: data.id, content: data.remark } });
const confirmDemand = (data) => request({ url: '/api/intervene/confirm', method: 'POST', data });
const reassign = (data) => request({ url: '/api/intervene/reassign', method: 'POST', data });

// 消息
const getMessageList = (params) => request({ url: '/api/message/list', method: 'GET', data: params });
const markMessageRead = (data) => request({ url: '/api/message/read', method: 'POST', data: { messageId: data.id } });
const archiveMessage = (data) => request({ url: '/api/message/archive', method: 'POST', data: { messageId: data.id } });
const archiveAllMessages = () => request({ url: '/api/message/archive-all', method: 'POST' });

// 统计
const getGridStats = (params) => request({ url: '/api/stats/grid', method: 'GET', data: { range: params.timeRange } });
const getAreaStats = (params) => request({ url: '/api/stats/area', method: 'GET', data: { range: params.timeRange } });

// 人员配置（管理员）
const getStaffConfig = (params) => request({ url: '/api/admin/staff', method: 'GET', data: params });
const updateStaff = (data) => request({ url: '/api/admin/staff/save', method: 'POST', data });

// 区域配置（管理员）
const getAreaConfigList = () => request({ url: '/api/admin/area-config', method: 'GET' });
const saveAreaConfig = (data) => request({ url: '/api/admin/area-config/save', method: 'POST', data });
const deleteAreaConfig = (id) => request({ url: `/api/admin/area-config/${id}`, method: 'DELETE' });
const getAreaConfigByArea = (area) => request({ url: `/api/admin/area-config/by-area/${encodeURIComponent(area)}`, method: 'GET' });

// 角色配置（管理员）
const getRoleConfigList = () => request({ url: '/api/admin/role-config', method: 'GET' });
const saveRoleConfig = (data) => request({ url: '/api/admin/role-config/save', method: 'POST', data });

// 人员单位/网格去重列表
const getStaffDistinct = () => request({ url: '/api/admin/staff/distinct', method: 'GET' });

// 系统配置
const getConfig = (key) => request({ url: `/api/config/${key}`, method: 'GET' });

// 系统公告
const getAnnouncementList = () => request({ url: '/api/announcement/list', method: 'GET' });
const getAnnouncementDetail = (id) => request({ url: `/api/announcement/detail/${id}`, method: 'GET' });

module.exports = {
  login, phonePasswordLogin, wxBind, bindPhone, changePassword, getUserRole,
  createDemand, updateDemand, getDemandList, getDemandDetail, getPendingList, rejectDemand, crossAreaReview, acknowledgeRejection,
  submitDesign, startConstruction, submitConstruction,
  getTimeoutList, sendRemind,
  forceStatus, addRemark, confirmDemand, reassign,
  getMessageList, markMessageRead, archiveMessage, archiveAllMessages,
  getGridStats, getAreaStats,
  getStaffConfig, updateStaff,
  getAreaConfigList, saveAreaConfig, deleteAreaConfig, getAreaConfigByArea,
  getRoleConfigList, saveRoleConfig,
  getStaffDistinct,
  getConfig,
  getAnnouncementList,
  getAnnouncementDetail
};
