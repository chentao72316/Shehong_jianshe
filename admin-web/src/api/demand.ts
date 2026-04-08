import request from './request'
import type { Demand } from '@/types'

// 获取需求列表
export async function getDemandList(params: {
  page?: number
  pageSize?: number
  keyword?: string
  area?: string
  status?: string | string[]
  type?: string
  dateFrom?: string
  dateTo?: string
  district?: string
}): Promise<{ list: Demand[]; total: number; stats?: any }> {
  const data = await request.get<{ list: Demand[]; total: number; stats?: any }>('/demand/list', { params })
  return data as unknown as { list: Demand[]; total: number; stats?: any }
}

// 获取需求详情
export async function getDemandDetail(id: string): Promise<Demand> {
  const data = await request.get<Demand>('/demand/detail', { params: { id } })
  return data as unknown as Demand
}

// 驳回需求
export async function rejectDemand(demandId: string, reason: string): Promise<void> {
  await request.post('/demand/reject', { demandId, reason })
}

// 删除工单
export async function deleteDemand(id: string): Promise<void> {
  await request.delete(`/demand/${id}`)
}

// 导出工单为 Excel（触发浏览器文件下载）
export async function exportDemands(params: {
  keyword?: string
  status?: string | string[]
  type?: string
  area?: string
  dateFrom?: string
  dateTo?: string
  district?: string
}): Promise<void> {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (!v) return
    query.append(k, Array.isArray(v) ? v.join(',') : v)
  })
  const token = localStorage.getItem('token')
  const res = await fetch(`/api/admin/demands/export?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('导出失败')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `工单导出_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
