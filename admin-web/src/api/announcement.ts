import request from './request'

export interface Announcement {
  _id: string
  title: string
  content: string
  startTime: string
  endTime: string | null
  active: boolean
  createdBy: { name: string } | string
  createdAt: string
}

export async function getAnnouncementAdminList(params: { page?: number; pageSize?: number }): Promise<{ list: Announcement[]; total: number }> {
  const data = await request.get<{ list: Announcement[]; total: number }>('/announcement/admin/list', { params })
  return data as unknown as { list: Announcement[]; total: number }
}

export async function createAnnouncement(payload: {
  title: string
  content: string
  startTime?: string
  endTime?: string
}): Promise<void> {
  await request.post('/announcement/create', payload)
}

export async function toggleAnnouncement(id: string, active: boolean): Promise<void> {
  await request.post('/announcement/toggle', { id, active })
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await request.delete(`/announcement/${id}`)
}
