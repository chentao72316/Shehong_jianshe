import request from './request'
import type { AreaConfig } from '@/types'

export async function getAreaConfigList(params?: { district?: string }): Promise<{ list: AreaConfig[] }> {
  const data = await request.get<{ list: AreaConfig[] }>('/admin/area-config', { params })
  return data as unknown as { list: AreaConfig[] }
}

export async function saveAreaConfig(data: {
  district: string
  acceptArea: string
  networkCenter?: string
  designCandidates?: string[]
  constructionCandidates?: string[]
  supervisorCandidates?: string[]
  networkManagerId?: string | null
  active?: boolean
}): Promise<{ id: string }> {
  const result = await request.post<{ id: string }>('/admin/area-config/save', data)
  return result as unknown as { id: string }
}

export async function deleteAreaConfig(id: string): Promise<void> {
  await request.delete(`/admin/area-config/${id}`)
}
