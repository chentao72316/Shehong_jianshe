import request from './request'
import type { LoginResponse } from '@/types'

// 手机号 + 密码登录（正式生产入口）
export async function phonePasswordLogin(phone: string, password: string): Promise<LoginResponse> {
  const data = await request.post<LoginResponse>('/auth/phone-password', { phone, password })
  return data as unknown as LoginResponse
}

// 获取用户角色
export async function getUserRole(): Promise<{ roles: string[]; userInfo: any }> {
  const data = await request.get<{ roles: string[]; userInfo: any }>('/user/role')
  return data as unknown as { roles: string[]; userInfo: any }
}
