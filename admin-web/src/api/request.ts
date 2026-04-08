import axios, { type AxiosInstance, type AxiosError } from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const request: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器：注入 Token
request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理，解构返回 data
request.interceptors.response.use(
  (response) => {
    const { code, data, message } = response.data
    if (code === 0) {
      return data
    }
    ElMessage.error(message || '请求失败')
    return Promise.reject(new Error(message))
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      ElMessage.error('登录已过期，请重新登录')
      router.push('/login')
    } else if (error.response?.status === 403) {
      ElMessage.error('无权限执行此操作')
    } else {
      ElMessage.error((error.response?.data as any)?.message || error.message || '网络错误')
    }
    return Promise.reject(error)
  }
)

export default request
