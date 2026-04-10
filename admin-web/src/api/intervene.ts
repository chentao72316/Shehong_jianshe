import request from './request'

// 重新指派
export async function reassignDemand(data: {
  demandId: string
  unitType: 'design' | 'construction' | 'supervisor'
  userId: string
}): Promise<void> {
  await request.post('/intervene/reassign', data)
}

// 强制变更状态
export async function forceStatus(demandId: string, status: string): Promise<void> {
  await request.post('/intervene/force-status', { demandId, status })
}

// 添加督办备注
export async function addRemark(demandId: string, remark: string): Promise<void> {
  await request.post('/intervene/remark', { demandId, remark })
}

export async function confirmDemand(data: {
  demandId: string
  action: 'approve' | 'reject'
  rejectReason?: string
}): Promise<{ status: string }> {
  const result = await request.post<{ status: string }>('/intervene/confirm', data)
  return result as unknown as { status: string }
}
