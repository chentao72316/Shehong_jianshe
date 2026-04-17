/**
 * timeout-checker.service.js
 *
 * ⚠️ 已废弃 - 本文件仅作为空壳存在
 * 实际的超时自动督办逻辑已迁移至 auto-reminder.service.js
 *
 * 历史说明：
 * - 旧版直接调用 notifyDesignWarning / notifyConstructionUrgent / sendTimeoutRemind
 *   无业务时段限制，每 10 分钟检查一次，与 auto-reminder.service 双跑导致重复飞书消息
 * - 现已统一由 auto-reminder.service 接管（受 8:30-18:30 时段槽控制，每小时检查一次）
 *
 * 本文件保留是为了避免任何可能的 import 路径破坏。
 * 如确认无其他模块依赖此路径，可彻底删除。
 */

// 空壳，直接透传给 auto-reminder.service
module.exports = require('./auto-reminder.service');
