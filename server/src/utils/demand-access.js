const RoleConfig = require('../models/role-config.model');

async function resolveVisibilityScope(user) {
  if (user?.gridName && user.gridName.includes('网络建设中心')) return 'all';

  const roles = user?.roles || [];
  const priority = [
    'ADMIN', 'GRID_MANAGER', 'NETWORK_MANAGER', 'LEVEL4_MANAGER',
    'DISTRICT_MANAGER', 'DEPT_MANAGER', 'DESIGN', 'CONSTRUCTION',
    'SUPERVISOR', 'FRONTLINE'
  ];
  const primaryRole = priority.find(r => roles.includes(r)) || roles[0];
  if (!primaryRole) return 'self';

  const config = await RoleConfig.findOne({ role: primaryRole }).lean();
  return config ? config.visibilityScope : 'self';
}

async function canUserAccessDemand(user, demand) {
  if (!user || !demand) return false;
  const roles = user.roles || [];
  if (roles.includes('ADMIN')) return true;

  const scope = await resolveVisibilityScope(user);
  if (scope === 'all') {
    return !demand.district || !user.district || demand.district === user.district;
  }

  const userId = String(user._id || user.userId || '');
  const creatorId = String(demand.createdBy?._id || demand.createdBy || '');
  const designId = String(demand.assignedDesignUnit?._id || demand.assignedDesignUnit || '');
  const constructionId = String(demand.assignedConstructionUnit?._id || demand.assignedConstructionUnit || '');
  const supervisorId = String(demand.assignedSupervisor?._id || demand.assignedSupervisor || '');
  const reviewerId = String(demand.crossAreaReviewerId?._id || demand.crossAreaReviewerId || '');

  switch (scope) {
    case 'area':
      return demand.acceptArea === user.area;
    case 'grid':
      return demand.gridName === user.gridName || demand.acceptArea === user.gridName;
    case 'assigned':
      return creatorId === userId ||
        designId === userId ||
        constructionId === userId ||
        supervisorId === userId ||
        reviewerId === userId;
    case 'self':
    default:
      return creatorId === userId;
  }
}

module.exports = { resolveVisibilityScope, canUserAccessDemand };
