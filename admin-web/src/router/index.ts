import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import type { Role } from '@/types'
import { getDefaultHomePath } from '@/utils/pc-access'

type AppRouteMeta = {
  requiresAuth?: boolean
  allowedRoles?: Role[]
  devOnly?: boolean
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/layout/AdminLayout.vue'),
    meta: { requiresAuth: true } as AppRouteMeta,
    children: [
      {
        path: '',
        redirect: '/demands'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'] } as AppRouteMeta
      },
      {
        path: 'staff',
        name: 'Staff',
        component: () => import('@/views/staff/StaffView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'] } as AppRouteMeta
      },
      {
        path: 'demands',
        name: 'Demands',
        component: () => import('@/views/demands/DemandListView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR'] } as AppRouteMeta
      },
      {
        path: 'timeout',
        name: 'Timeout',
        component: () => import('@/views/timeout/TimeoutView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'] } as AppRouteMeta
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('@/views/stats/StatsView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'] } as AppRouteMeta
      },
      {
        path: 'config',
        name: 'Config',
        component: () => import('@/views/config/ConfigView.vue'),
        meta: { allowedRoles: ['ADMIN'] } as AppRouteMeta
      },
      {
        path: 'area-config',
        name: 'AreaConfig',
        component: () => import('@/views/area-config/AreaConfigView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER'] } as AppRouteMeta
      },
      {
        path: 'role-config',
        name: 'RoleConfig',
        component: () => import('@/views/role-config/RoleConfigView.vue'),
        meta: { allowedRoles: ['ADMIN'] } as AppRouteMeta
      },
      {
        path: 'announcement',
        name: 'Announcement',
        component: () => import('@/views/announcement/AnnouncementView.vue'),
        meta: { allowedRoles: ['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER', 'DESIGN', 'CONSTRUCTION', 'SUPERVISOR'] } as AppRouteMeta
      },
      // DEV-ONLY: 测试面板，上线前删除
      ...(import.meta.env.DEV ? [{
        path: 'test',
        name: 'TestPanel',
        component: () => import('@/views/dev/TestPanelView.vue'),
        meta: { devOnly: true }
      }] as RouteRecordRaw[] : [])
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const userStore = useUserStore()
  userStore.loadFromStorage()
  const routeMeta = to.meta as AppRouteMeta
  const defaultHomePath = getDefaultHomePath(userStore.userInfo)

  if (routeMeta.requiresAuth && !userStore.token) {
    next('/login')
  } else if (to.path === '/login' && userStore.token) {
    next(defaultHomePath)
  } else if (userStore.token && !userStore.canPcLogin()) {
    userStore.logout()
    ElMessage.error('当前角色不支持 PC 端登录')
    next('/login')
  } else if (routeMeta.allowedRoles && routeMeta.allowedRoles.length > 0 && !userStore.hasAnyRole(routeMeta.allowedRoles)) {
    ElMessage.error('当前角色无权访问该页面')
    next(defaultHomePath)
  } else {
    next()
  }
})

export default router
