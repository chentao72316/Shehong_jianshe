function toId(value) {
  return String(value?._id || value || '');
}

function uniqueIds(values) {
  const ids = [];
  const seen = new Set();
  (values || []).forEach((value) => {
    const id = toId(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  });
  return ids;
}

function pickActiveCandidates(populatedList) {
  return (populatedList || []).filter((user) => user && user.active !== false);
}

function getAssignmentIds(demand, singleField, multiField) {
  return uniqueIds([
    ...(demand?.[multiField] || []),
    demand?.[singleField]
  ]);
}

function isUserAssignedTo(demand, user, singleField, multiField) {
  const userId = toId(user?._id || user?.userId);
  if (!userId) return false;
  return getAssignmentIds(demand, singleField, multiField).includes(userId);
}

function getAllAssignedUserIds(demand) {
  return uniqueIds([
    ...(demand?.assignedDesignUnits || []),
    demand?.assignedDesignUnit,
    ...(demand?.assignedConstructionUnits || []),
    demand?.assignedConstructionUnit,
    ...(demand?.assignedSupervisors || []),
    demand?.assignedSupervisor
  ]);
}

function namesOf(users) {
  return (users || []).map((user) => user?.name).filter(Boolean).join('、');
}

module.exports = {
  toId,
  uniqueIds,
  pickActiveCandidates,
  getAssignmentIds,
  isUserAssignedTo,
  getAllAssignedUserIds,
  namesOf
};
