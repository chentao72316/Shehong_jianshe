<template>
  <div class="admin-layout">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">建</div>
        <div class="logo-text">
          <div class="logo-title">射洪建设</div>
          <div class="logo-sub">管理后台</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(item.path) }"
        >
          <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
        </router-link>

        <router-link
          v-if="isDev"
          to="/test"
          class="nav-item nav-item--dev"
          :class="{ 'nav-item--active': isActive('/test') }"
        >
          <el-icon class="nav-icon"><Tools /></el-icon>
          <span class="nav-label">测试工具</span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="user-card">
          <div class="user-avatar">
            {{ (userStore.userInfo?.name || '管')[0] }}
          </div>
          <div class="user-info">
            <div class="user-name">{{ userStore.userInfo?.name || '管理员' }}</div>
            <div class="user-role">{{ userRoleLabel }}</div>
          </div>
          <el-dropdown @command="handleCommand" trigger="click">
            <button class="user-menu-btn">
              <el-icon><MoreFilled /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </aside>

    <!-- 主区域 -->
    <div class="main-wrapper">
      <!-- 顶栏 -->
      <header class="topbar">
        <div class="topbar-left">
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="topbar-right">
          <!-- 区县切换 -->
          <div class="district-control">
            <template v-if="districtStore.isAdmin">
              <el-select
                v-model="selectedDistrict"
                size="small"
                placeholder="全部区县"
                clearable
                @change="districtStore.setDistrict($event)"
                style="width: 120px;"
              >
                <el-option label="全部区县" :value="null" />
                <el-option
                  v-for="d in districtStore.DISTRICTS"
                  :key="d"
                  :label="d"
                  :value="d"
                />
              </el-select>
            </template>
            <template v-else>
              <span class="district-tag">
                <el-icon style="font-size: 12px; margin-right: 4px;"><Location /></el-icon>
                {{ districtStore.currentDistrict || '射洪市' }}
              </span>
            </template>
          </div>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useDistrictStore } from '@/stores/district'
import type { Role } from '@/types'
import { getRoleLabel } from '@/utils/pc-access'
import {
  DataAnalysis, User, Document, Clock, PieChart,
  Setting, MapLocation, Key, Bell, Tools, MoreFilled, Location
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const districtStore = useDistrictStore()
const isDev = import.meta.env.DEV

const selectedDistrict = ref<string | null>(districtStore.currentDistrict)

interface NavItem {
  path: string
  label: string
  icon: Component
  badge?: string | number
  roles: Role[]
}

const navItems = computed<NavItem[]>(() => {
  const demandLabel = userStore.hasAnyRole(['DESIGN', 'CONSTRUCTION', 'SUPERVISOR']) ? '我的工单' : '工单列表'
  const items: NavItem[] = [
    { path: '/dashboard', label: '管理首页', icon: DataAnalysis, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'] },
    { path: '/staff', label: '人员配置', icon: User, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'] },
    { path: '/demands', label: demandLabel, icon: Document, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR'] },
    { path: '/timeout', label: '超时督办', icon: Clock, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'] },
    { path: '/stats', label: '统计报表', icon: PieChart, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'] },
    { path: '/config', label: '系统配置', icon: Setting, roles: ['ADMIN'] },
    { path: '/area-config', label: '区域配置', icon: MapLocation, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'] },
    { path: '/role-config', label: '角色权限', icon: Key, roles: ['ADMIN'] },
    { path: '/announcement', label: '系统公告', icon: Bell, roles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR'] }
  ]

  return items.filter((item) => userStore.hasAnyRole(item.roles))
})

const userRoleLabel = computed(() => {
  return getRoleLabel(userStore.userInfo)
})

const isActive = (path: string) => route.path === path || route.path.startsWith(path + '/')

const pageTitle = computed(() => {
  const titleMap: Record<string, string> = {
    '/dashboard':    '管理首页',
    '/staff':        '人员配置',
    '/demands':      '工单列表',
    '/timeout':      '超时督办',
    '/stats':        '统计报表',
    '/config':       '系统配置',
    '/area-config':  '区域配置',
    '/role-config':  '角色权限',
    '/announcement': '系统公告',
    '/test':         '测试工具'
  }
  return titleMap[route.path] || ''
})

const handleCommand = (command: string) => {
  if (command === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
/* ── Layout Shell ─────────────────────────────────────────── */
.admin-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background: var(--color-bg);
}

/* ── Sidebar ──────────────────────────────────────────────── */
.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--color-sidebar-bg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-logo {
  height: 64px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--color-sidebar-border);
  flex-shrink: 0;
}

.logo-icon {
  width: 34px;
  height: 34px;
  background: var(--color-accent);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  flex-shrink: 0;
}

.logo-title {
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  line-height: 1.2;
}

.logo-sub {
  color: var(--color-sidebar-text);
  font-size: 11px;
  margin-top: 1px;
}

/* Nav */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 6px;
  color: var(--color-sidebar-text);
  text-decoration: none;
  font-size: 13.5px;
  font-weight: 450;
  transition: background 0.12s, color 0.12s;
  position: relative;
  white-space: nowrap;
}

.nav-item:hover {
  background: var(--color-sidebar-hover);
  color: #e2e8f0;
}

.nav-item--active {
  background: var(--color-sidebar-active);
  color: var(--color-sidebar-text-active) !important;
  font-weight: 600;
}

.nav-item--active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  background: #60a5fa;
  border-radius: 0 2px 2px 0;
}

.nav-icon {
  font-size: 16px;
  flex-shrink: 0;
  opacity: 0.85;
}

.nav-item--active .nav-icon {
  opacity: 1;
}

.nav-label {
  flex: 1;
}

.nav-badge {
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.nav-item--dev {
  color: #f59e0b;
  margin-top: 8px;
}

/* Sidebar footer */
.sidebar-footer {
  padding: 12px 10px;
  border-top: 1px solid var(--color-sidebar-border);
  flex-shrink: 0;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  transition: background 0.12s;
}

.user-card:hover {
  background: var(--color-sidebar-hover);
}

.user-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  color: #e2e8f0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  color: var(--color-sidebar-text);
  font-size: 11px;
  margin-top: 1px;
}

.user-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-sidebar-text);
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  transition: color 0.12s;
}

.user-menu-btn:hover {
  color: #e2e8f0;
}

/* ── Main Area ────────────────────────────────────────────── */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* Topbar */
.topbar {
  height: 56px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.district-control {
  display: flex;
  align-items: center;
}

.district-tag {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  padding: 4px 12px;
  font-weight: 500;
}

/* Main content */
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>
