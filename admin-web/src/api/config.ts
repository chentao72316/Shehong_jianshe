import request from './request'

export interface ConfigItem {
  key: string
  value: any
  label?: string
  description?: string
  updatedAt?: string
}

// 获取配置项
export const getConfig = async <T = any>(key: string): Promise<T> =>
  await request.get(`/config/${key}`) as unknown as T

// 更新配置项
export const updateConfig = async (key: string, data: { value: any; label?: string; description?: string }): Promise<ConfigItem> =>
  await request.put(`/config/${key}`, data) as unknown as ConfigItem

// 获取配置列表
export const getConfigList = async (): Promise<ConfigItem[]> =>
  await request.get('/config/list') as unknown as ConfigItem[]
