// 计算两个时间点之间的天数差
function calcDaysDiff(startTime, endTime) {
  if (!startTime) return null;
  const end = endTime ? new Date(endTime) : new Date();
  const start = new Date(startTime);
  const diff = (end - start) / (1000 * 3600 * 24);
  return Math.round(diff * 10) / 10;
}

// 格式化时间显示
function formatTime(timeStr) {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

// 格式化日期
function formatDate(timeStr) {
  if (!timeStr) return '-';
  const d = new Date(timeStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 计算剩余天数（正数=未超时，负数=已超时）
function calcRemainingDays(assignTime, standardDays) {
  if (!assignTime) return null;
  const elapsed = calcDaysDiff(assignTime);
  return Math.round((standardDays - elapsed) * 10) / 10;
}

module.exports = { calcDaysDiff, formatTime, formatDate, calcRemainingDays };
