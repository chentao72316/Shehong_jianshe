const { minutesBetween } = require('./format');

function recalculateDemandDurations(demand, referenceTime = new Date()) {
  const now = referenceTime instanceof Date ? referenceTime : new Date(referenceTime);
  const totalEndTime = demand.completedTime || demand.confirmTime || now;

  demand.totalDuration = demand.createdAt ? minutesBetween(demand.createdAt, totalEndTime) : null;

  if (demand.designAssignTime) {
    let designEndTime = null;

    if (demand.constructionAssignTime) {
      designEndTime = demand.constructionAssignTime;
    } else if (demand.confirmTime) {
      designEndTime = demand.confirmTime;
    } else if (demand.completedTime) {
      designEndTime = demand.completedTime;
    } else if (demand.status === '设计中' || demand.status === '待确认') {
      designEndTime = now;
    }

    demand.designDuration = designEndTime ? minutesBetween(demand.designAssignTime, designEndTime) : null;
  } else {
    demand.designDuration = null;
  }

  if (demand.constructionAssignTime) {
    let constructionEndTime = null;

    if (demand.confirmTime) {
      constructionEndTime = demand.confirmTime;
    } else if (demand.completedTime) {
      constructionEndTime = demand.completedTime;
    } else if (demand.status === '施工中' || demand.status === '待确认') {
      constructionEndTime = now;
    }

    demand.constructionDuration = constructionEndTime
      ? minutesBetween(demand.constructionAssignTime, constructionEndTime)
      : null;
  } else {
    demand.constructionDuration = null;
  }

  return demand;
}

module.exports = { recalculateDemandDurations };
