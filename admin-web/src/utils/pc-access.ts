import type { Role, UserInfo } from '@/types'

export const PC_LOGIN_ROLES: Role[] = [
  'ADMIN',
  'DISTRICT_MANAGER',
  'LEVEL4_MANAGER',
  'NETWORK_MANAGER',
  'DESIGN',
  'CONSTRUCTION',
  'SUPERVISOR'
]

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: '超级管理员',
  DISTRICT_MANAGER: '区县管理员',
  LEVEL4_MANAGER: '四级经理',
  NETWORK_MANAGER: '网络支撑经理',
  DESIGN: '设计单位',
  CONSTRUCTION: '施工单位',
  SUPERVISOR: '监理单位',
  GRID_MANAGER: '网格经理',
  FRONTLINE: '一线人员',
  DEPT_MANAGER: '部门经理'
}

export const DEFAULT_HOME_BY_ROLE: Partial<Record<Role, string>> = {
  ADMIN: '/dashboard',
  DISTRICT_MANAGER: '/dashboard',
  LEVEL4_MANAGER: '/dashboard',
  NETWORK_MANAGER: '/dashboard',
  DESIGN: '/demands',
  CONSTRUCTION: '/demands',
  SUPERVISOR: '/demands'
}

export function hasRole(userInfo: UserInfo | null | undefined, roles: Role[]) {
  const userRoles = userInfo?.roles || []
  return roles.some((role) => userRoles.includes(role))
}

export function canPcLogin(userInfo: UserInfo | null | undefined) {
  if (!userInfo) return false
  if (typeof userInfo.canPcLogin === 'boolean') return userInfo.canPcLogin
  return hasRole(userInfo, PC_LOGIN_ROLES)
}

export function getPrimaryRole(userInfo: UserInfo | null | undefined): Role | null {
  if (!userInfo) return null
  if (userInfo.pcRole) return userInfo.pcRole
  if (userInfo.role) return userInfo.role
  return userInfo.roles?.[0] || null
}

export function getRoleLabel(userInfo: UserInfo | null | undefined) {
  const primaryRole = getPrimaryRole(userInfo)
  if (!primaryRole) return '未分配角色'
  return ROLE_LABELS[primaryRole] || primaryRole
}

export function getDefaultHomePath(userInfo: UserInfo | null | undefined) {
  const primaryRole = getPrimaryRole(userInfo)
  if (!primaryRole) return '/demands'
  return DEFAULT_HOME_BY_ROLE[primaryRole] || '/demands'
}
