const RoleConfig = require('../models/role-config.model');
const { logger } = require('../utils/logger');

const DEFAULT_ROLE_CONFIGS = [
  { role: 'FRONTLINE',        label: '一线人员',       visibilityScope: 'self',     description: '只能查看自己提交的工单' },
  { role: 'GRID_MANAGER',     label: '网格经理',       visibilityScope: 'grid',     description: '看本网格提交及受理的所有工单' },
  { role: 'NETWORK_MANAGER',  label: '网络支撑经理',   visibilityScope: 'area',     description: '看本支撑区域的所有工单' },
  { role: 'DISTRICT_MANAGER', label: '区县管理员',     visibilityScope: 'district', description: '仅看本区县工单' },
  { role: 'DEPT_MANAGER',     label: '部门经理',       visibilityScope: 'grid',     description: '看本部门/网格的工单' },
  { role: 'LEVEL4_MANAGER',   label: '四级经理',       visibilityScope: 'district', description: '仅看本区县工单' },
  { role: 'DESIGN',           label: '设计',           visibilityScope: 'assigned', description: '只看派发给自己和自己处理过的工单' },
  { role: 'CONSTRUCTION',     label: '施工',           visibilityScope: 'assigned', description: '只看派发给自己和自己处理过的工单' },
  { role: 'SUPERVISOR',       label: '监理',           visibilityScope: 'assigned', description: '只看派发给自己和自己处理过的工单' },
  { role: 'ADMIN',            label: '管理员',         visibilityScope: 'all',      description: '看全部工单，无限制' }
];

/**
 * 初始化角色默认配置（LEVEL4_MANAGER 强制更新，其余仅插入不覆盖）
 */
async function seedRoleConfig() {
  try {
    for (const cfg of DEFAULT_ROLE_CONFIGS) {
      // LEVEL4_MANAGER 的 scope 从 area 改为 grid，需强制覆盖已有记录
      const update = cfg.role === 'LEVEL4_MANAGER'
        ? { $set: cfg }
        : { $setOnInsert: cfg };
      await RoleConfig.findOneAndUpdate(
        { role: cfg.role },
        update,
        { upsert: true, new: false }
      );
    }
    logger.info('RoleConfig 初始化完成');
  } catch (err) {
    logger.error('RoleConfig 初始化失败', { error: err.message });
  }
}

module.exports = { seedRoleConfig };
