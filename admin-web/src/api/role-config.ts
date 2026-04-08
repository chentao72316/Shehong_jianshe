import request from './request'
import type { RoleConfig } from '@/types'

export async function getRoleConfigList(): Promise<{ list: RoleConfig[] }> {
  const data = await request.get<{ list: RoleConfig[] }>('/admin/role-config')
  return data as unknown as { list: RoleConfig[] }
}

export async function saveRoleConfig(data: {
  role: string
  visibilityScope: string
  description?: string
}): Promise<{ role: string; visibilityScope: string }> {
  const result = await request.post('/admin/role-config/save', data)
  return result as unknown as { role: string; visibilityScope: string }
}
