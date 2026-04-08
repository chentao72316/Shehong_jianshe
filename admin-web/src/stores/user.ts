import { defineStore } from 'pinia'
import type { UserInfo } from '@/types'

interface UserState {
  userInfo: UserInfo | null
  token: string | null
}

export const useUserStore = defineStore('user', {
  state: (): UserState => ({
    userInfo: null,
    token: null
  }),

  actions: {
    setUser(userInfo: UserInfo, token: string) {
      this.userInfo = userInfo
      this.token = token
      localStorage.setItem('user', JSON.stringify(userInfo))
      localStorage.setItem('token', token)
    },

    loadFromStorage() {
      const userStr = localStorage.getItem('user')
      const token = localStorage.getItem('token')
      if (userStr && token) {
        try {
          this.userInfo = JSON.parse(userStr)
          this.token = token
        } catch {
          localStorage.removeItem('user')
          localStorage.removeItem('token')
        }
      }
    },

    logout() {
      this.userInfo = null
      this.token = null
      localStorage.removeItem('user')
      localStorage.removeItem('token')
    },

    isAdmin(): boolean {
      return this.userInfo?.roles?.includes('ADMIN') || false
    }
  }
})
