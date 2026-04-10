import { defineStore } from 'pinia'
import type { Role, UserInfo } from '@/types'
import { canPcLogin, getDefaultHomePath, getPrimaryRole, hasRole } from '@/utils/pc-access'

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
    },

    canPcLogin(): boolean {
      return canPcLogin(this.userInfo)
    },

    hasAnyRole(roles: Role[]): boolean {
      return hasRole(this.userInfo, roles)
    },

    getPrimaryRole(): Role | null {
      return getPrimaryRole(this.userInfo)
    },

    getDefaultHomePath(): string {
      return getDefaultHomePath(this.userInfo)
    },

    isDistrictAdmin(): boolean {
      return this.hasAnyRole(['DISTRICT_MANAGER'])
    },

    isLevel4Manager(): boolean {
      return this.hasAnyRole(['LEVEL4_MANAGER'])
    },

    isNetworkManager(): boolean {
      return this.hasAnyRole(['NETWORK_MANAGER'])
    },

    isDesign(): boolean {
      return this.hasAnyRole(['DESIGN'])
    },

    isConstruction(): boolean {
      return this.hasAnyRole(['CONSTRUCTION'])
    },

    isSupervisor(): boolean {
      return this.hasAnyRole(['SUPERVISOR'])
    }
  }
})
