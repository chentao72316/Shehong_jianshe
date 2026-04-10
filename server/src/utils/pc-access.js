const PC_LOGIN_ROLES = [
  'ADMIN',
  'DISTRICT_MANAGER',
  'LEVEL4_MANAGER',
  'NETWORK_MANAGER',
  'DESIGN',
  'CONSTRUCTION',
  'SUPERVISOR'
];

const ROLE_PRIORITY = [
  'ADMIN',
  'DISTRICT_MANAGER',
  'LEVEL4_MANAGER',
  'NETWORK_MANAGER',
  'DESIGN',
  'CONSTRUCTION',
  'SUPERVISOR',
  'GRID_MANAGER',
  'DEPT_MANAGER',
  'FRONTLINE'
];

const DEMAND_SCOPE_BY_ROLE = {
  ADMIN: 'all',
  DISTRICT_MANAGER: 'district',
  LEVEL4_MANAGER: 'district',
  NETWORK_MANAGER: 'area',
  DESIGN: 'assigned',
  CONSTRUCTION: 'assigned',
  SUPERVISOR: 'assigned'
};

function getPrimaryRole(user) {
  const roles = user?.roles || [];
  return ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0] || null;
}

function canPcLogin(user) {
  const roles = user?.roles || [];
  return roles.some((role) => PC_LOGIN_ROLES.includes(role));
}

function getDemandVisibilityScope(user) {
  const primaryRole = getPrimaryRole(user);
  return DEMAND_SCOPE_BY_ROLE[primaryRole] || null;
}

function getAssignedOrProcessedDemandFilter(user) {
  const userId = String(user?._id || user?.userId || '');
  if (!userId) return { _id: null };

  return {
    $or: [
      { assignedDesignUnit: userId },
      { assignedConstructionUnit: userId },
      { assignedSupervisor: userId },
      { 'logs.operatorId': userId }
    ]
  };
}

function hasProcessedDemand(user, demand) {
  const userId = String(user?._id || user?.userId || '');
  if (!userId) return false;

  return Array.isArray(demand?.logs) && demand.logs.some((log) => {
    const operatorId = String(log?.operatorId || '');
    return operatorId === userId;
  });
}

function canAccessAssignedDemand(user, demand) {
  const userId = String(user?._id || user?.userId || '');
  if (!userId || !demand) return false;

  const designId = String(demand.assignedDesignUnit?._id || demand.assignedDesignUnit || '');
  const constructionId = String(demand.assignedConstructionUnit?._id || demand.assignedConstructionUnit || '');
  const supervisorId = String(demand.assignedSupervisor?._id || demand.assignedSupervisor || '');

  return designId === userId ||
    constructionId === userId ||
    supervisorId === userId ||
    hasProcessedDemand(user, demand);
}

module.exports = {
  PC_LOGIN_ROLES,
  ROLE_PRIORITY,
  getPrimaryRole,
  canPcLogin,
  getDemandVisibilityScope,
  getAssignedOrProcessedDemandFilter,
  hasProcessedDemand,
  canAccessAssignedDemand
};
