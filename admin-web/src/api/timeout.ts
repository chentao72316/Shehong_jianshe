import request from './request'
import type { Demand, PaginatedResponse } from '@/types'

// 获取超时需求列表
export async function getTimeoutList(params: {
  page?: number
  pageSize?: number
  area?: string
  district?: string
}): Promise<PaginatedResponse<Demand>> {
  const data = await request.get<PaginatedResponse<Demand>>('/timeout/list', { params })
  return data as unknown as PaginatedResponse<Demand>
}

// 发送催办提醒
export async function sendRemind(demandId: string): Promise<void> {
  await request.post('/timeout/remind', { demandId })
}
