const AreaConfig = require('../models/area-config.model');

function mergeFilter(baseFilter, extraFilter) {
  if (!baseFilter || Object.keys(baseFilter).length === 0) return extraFilter;
  if (!extraFilter || Object.keys(extraFilter).length === 0) return baseFilter;
  return { $and: [baseFilter, extraFilter] };
}

async function getManagedAcceptAreas(user) {
  const district = user?.district || '射洪市';
  const acceptAreaSet = new Set();
  const gridName = user?.gridName || '';

  if (user?._id) {
    const areaConfigs = await AreaConfig.find({
      district,
      active: true,
      $or: [
        { networkManagerId: user._id },
        ...(gridName ? [{ networkCenter: gridName }] : [])
      ]
    })
      .select('acceptArea')
      .lean();

    areaConfigs.forEach((item) => {
      if (item?.acceptArea) acceptAreaSet.add(item.acceptArea);
    });
  }

  return Array.from(acceptAreaSet);
}

async function buildNetworkManagerDemandFilter(user) {
  const orFilters = [];
  const managedAcceptAreas = await getManagedAcceptAreas(user);

  if (managedAcceptAreas.length > 0) {
    orFilters.push({ acceptArea: { $in: managedAcceptAreas } });
  }
  if (user?.gridName) {
    orFilters.push({ networkSupport: user.gridName });
  }
  if (user?.area) {
    orFilters.push({ acceptArea: user.area });
  }

  if (orFilters.length === 0) return { _id: null };
  if (orFilters.length === 1) return orFilters[0];
  return { $or: orFilters };
}

async function canNetworkManagerAccessDemand(user, demand) {
  if (!user || !demand) return false;
  const managedAcceptAreas = await getManagedAcceptAreas(user);

  if (managedAcceptAreas.includes(demand.acceptArea)) return true;
  if (user.gridName && demand.networkSupport === user.gridName) return true;
  if (user.area && demand.acceptArea === user.area) return true;
  return false;
}

async function resolveDemandNetworkSupport(district, acceptArea, existingValue = '') {
  if (existingValue) return existingValue;

  const areaConfig = await AreaConfig.findOne({ district, acceptArea, active: true })
    .select('networkCenter')
    .lean();
  if (areaConfig?.networkCenter) return areaConfig.networkCenter;

  return '';
}

module.exports = {
  mergeFilter,
  getManagedAcceptAreas,
  buildNetworkManagerDemandFilter,
  canNetworkManagerAccessDemand,
  resolveDemandNetworkSupport
};
