import request from './request'
import axios from 'axios'
import type { AdminOverview, StaffMember, PaginatedResponse } from '@/types'

// 获取管理员总览统计
export async function getAdminOverview(params?: { district?: string }): Promise<AdminOverview> {
  const data = await request.get<AdminOverview>('/admin/overview', { params })
  return data as unknown as AdminOverview
}

// 获取人员列表
export async function getStaffList(params: {
  page?: number
  pageSize?: number
  role?: string
  keyword?: string
  district?: string
}): Promise<PaginatedResponse<StaffMember>> {
  const data = await request.get<PaginatedResponse<StaffMember>>('/admin/staff', { params })
  return data as unknown as PaginatedResponse<StaffMember>
}

// 保存人员（新增或更新）
export async function saveStaff(data: Partial<StaffMember> & { userId?: string; district?: string }): Promise<{ userId: string }> {
  const result = await request.post<{ userId: string }>('/admin/staff/save', data)
  return result as unknown as { userId: string }
}

// 启用/禁用账号
export async function toggleStaff(userId: string, active: boolean): Promise<void> {
  await request.post('/admin/staff/toggle', { userId, active })
}

// 删除人员
export async function deleteStaff(userId: string): Promise<void> {
  await request.delete(`/admin/staff/${userId}`)
}

// 导出人员配置（使用 Blob 下载）
export async function exportStaff(params?: { district?: string }): Promise<void> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
  const token = localStorage.getItem('token')
  const query = params?.district ? `?district=${encodeURIComponent(params.district)}` : ''

  const response = await axios.get(`${baseURL}/admin/staff/export${query}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseType: 'blob'
  })

  // 从 Content-Disposition header 获取文件名
  const contentDisposition = response.headers['content-disposition']
  let filename = `staff_config_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) {
      filename = match[1].replace(/['"]/g, '')
    }
  }

  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// 获取已登记的单位/网格去重列表（用于下拉）
export async function getStaffDistinct(params?: { district?: string }): Promise<{ areas: string[]; gridNames: string[] }> {
  const data = await request.get('/admin/staff/distinct', { params })
  return data as unknown as { areas: string[]; gridNames: string[] }
}

// 管理员重置用户密码
export async function resetPassword(userId: string, newPassword: string): Promise<void> {
  await request.post('/auth/reset-password', { userId, newPassword })
}

// 导入人员配置
export async function importStaff(data: any[]): Promise<{
  message: string
  details: {
    success: number
    updated: number
    added: number
    skipped: number
    errors: string[]
  }
}> {
  const result = await request.post('/admin/staff/import', { data })
  return result as unknown as {
    message: string
    details: {
      success: number
      updated: number
      added: number
      skipped: number
      errors: string[]
    }
  }
}
