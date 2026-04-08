import request from './request'
import type { AreaStats, GridStats } from '@/types'

export interface StatusSummaryItem {
  status: string
  count: number
}

// 获取区域统计
export async function getAreaStats(params?: { range?: string; district?: string }): Promise<AreaStats[]> {
  const data = await request.get<AreaStats[]>('/stats/area', { params })
  return (data as unknown as AreaStats[]) || []
}

// 获取网格统计
export async function getGridStats(params?: { range?: string; district?: string }): Promise<GridStats[]> {
  const data = await request.get<GridStats[]>('/stats/grid', { params })
  return (data as unknown as GridStats[]) || []
}

// 获取工单状态分布（用于饼图）
export async function getStatusSummary(params?: { range?: string; district?: string }): Promise<StatusSummaryItem[]> {
  const data = await request.get<StatusSummaryItem[]>('/stats/status-summary', { params })
  return (data as unknown as StatusSummaryItem[]) || []
}
