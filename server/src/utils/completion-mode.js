const COMPLETION_MODE = {
  EXISTING_RESOURCE: 'EXISTING_RESOURCE',
  CONSTRUCTION_BUILD: 'CONSTRUCTION_BUILD'
};

const COMPLETION_MODE_LABEL = {
  [COMPLETION_MODE.EXISTING_RESOURCE]: '存量资源开通',
  [COMPLETION_MODE.CONSTRUCTION_BUILD]: '施工建设开通'
};

function inferCompletionMode(demand = {}) {
  if (demand.completionMode) return demand.completionMode;
  if (demand.status !== '已开通') return '';

  const hasConstructionInfo = Boolean(
    demand.constructionAssignTime ||
    demand.coverageName ||
    (demand.constructionPhotos && demand.constructionPhotos.length > 0) ||
    demand.constructionDuration != null
  );

  if (hasConstructionInfo) return COMPLETION_MODE.CONSTRUCTION_BUILD;
  if (demand.hasResource === true) return COMPLETION_MODE.EXISTING_RESOURCE;
  return '';
}

function getCompletionModeLabel(mode) {
  return COMPLETION_MODE_LABEL[mode] || '';
}

module.exports = {
  COMPLETION_MODE,
  COMPLETION_MODE_LABEL,
  inferCompletionMode,
  getCompletionModeLabel
};
