const RoleConfig = require('../models/role-config.model');
const {
  ROLE_PRIORITY,
  getPrimaryRole,
  getDemandVisibilityScope,
  canAccessAssignedDemand
} = require('./pc-access');
const { canNetworkManagerAccessDemand } = require('./network-manager-scope');

async function resolveVisibilityScope(user) {
  const explicitScope = getDemandVisibilityScope(user);
  if (explicitScope) return explicitScope;
  if (user?.gridName && user.gridName.includes('网络建设中心')) return 'all';

  const roles = user?.roles || [];
  const primaryRole = ROLE_PRIORITY.find((role) => roles.includes(role)) || roles[0];
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

  switch (scope) {
    case 'district':
      return !demand.district || !user.district || demand.district === user.district;
    case 'area':
      if ((roles || []).includes('NETWORK_MANAGER')) {
        return canNetworkManagerAccessDemand(user, demand);
      }
      return demand.acceptArea === user.area;
    case 'grid':
      return demand.gridName === user.gridName || demand.acceptArea === user.gridName;
    case 'assigned':
      return canAccessAssignedDemand(user, demand);
    case 'self':
    default:
      return creatorId === userId;
  }
}

module.exports = { resolveVisibilityScope, canUserAccessDemand };
