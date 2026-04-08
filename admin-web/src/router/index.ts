import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'

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
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      {
        path: '',
        redirect: '/dashboard'
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue')
      },
      {
        path: 'staff',
        name: 'Staff',
        component: () => import('@/views/staff/StaffView.vue')
      },
      {
        path: 'demands',
        name: 'Demands',
        component: () => import('@/views/demands/DemandListView.vue')
      },
      {
        path: 'timeout',
        name: 'Timeout',
        component: () => import('@/views/timeout/TimeoutView.vue')
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('@/views/stats/StatsView.vue')
      },
      {
        path: 'config',
        name: 'Config',
        component: () => import('@/views/config/ConfigView.vue')
      },
      {
        path: 'area-config',
        name: 'AreaConfig',
        component: () => import('@/views/area-config/AreaConfigView.vue')
      },
      {
        path: 'role-config',
        name: 'RoleConfig',
        component: () => import('@/views/role-config/RoleConfigView.vue')
      },
      {
        path: 'announcement',
        name: 'Announcement',
        component: () => import('@/views/announcement/AnnouncementView.vue')
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

  if (to.meta.requiresAuth && !userStore.token) {
    next('/login')
  } else if (to.path === '/login' && userStore.token) {
    next('/dashboard')
  } else if (to.meta.requiresAdmin && !userStore.isAdmin()) {
    // 无论是否有 token，非管理员一律跳回登录页，避免无限重定向
    userStore.logout()
    ElMessage.error('仅管理员可访问，请使用管理员账号登录')
    next('/login')
  } else {
    next()
  }
})

export default router
