import axios from 'axios'

export async function uploadAttachment(file: File, fileType: 'image' | 'file') {
  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('token')
  const response = await axios.post(`/api/upload/${fileType}`, formData, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  })

  const { code, data, message } = response.data
  if (code !== 0) {
    throw new Error(message || '上传失败')
  }

  return data as { url: string; filename: string }
}
