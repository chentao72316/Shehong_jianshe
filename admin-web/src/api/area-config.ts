import request from './request'
import axios from 'axios'
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

export async function exportAreaConfig(params?: { district?: string }): Promise<void> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
  const token = localStorage.getItem('token')
  const query = params?.district ? `?district=${encodeURIComponent(params.district)}` : ''

  const response = await axios.get(`${baseURL}/admin/area-config/export${query}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    responseType: 'blob'
  })

  const contentDisposition = response.headers['content-disposition']
  let filename = `area_config_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
    if (match && match[1]) filename = match[1].replace(/['"]/g, '')
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

export async function importAreaConfig(data: any[]): Promise<{
  message: string
  details: {
    success: number
    updated: number
    added: number
    skipped: number
    errors: string[]
  }
}> {
  const result = await request.post('/admin/area-config/import', { data })
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
