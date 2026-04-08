/**
 * format.js
 * 共享格式化工具函数，避免在 notify.js / feishu-bitable.js / admin.js 中重复定义
 */

/**
 * 格式化日期为可读字符串
 */
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('zh-CN', { hour12: false });
}

/**
 * 将分钟数转换为 "X天X小时X分钟" 字符串
 */
function fmtDuration(minutes) {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return '-';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts = [];
  if (days) parts.push(`${days}天`);
  if (hours) parts.push(`${hours}小时`);
  if (mins && !days) parts.push(`${mins}分钟`);
  return parts.length ? parts.join('') : '不足1分钟';
}

/**
 * 计算两个时间点之间的分钟数
 */
function minutesBetween(start, end) {
  if (!start || !end) return null;
  return Math.floor((new Date(end) - new Date(start)) / 60000);
}

module.exports = { fmtDate, fmtDuration, minutesBetween };
