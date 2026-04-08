import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useUserStore } from './user'

export const DISTRICTS = ['射洪市', '蓬溪县', '大英县', '船山区', '安居区'] as const
export type District = typeof DISTRICTS[number]

const STORAGE_KEY = 'selected_district'

export const useDistrictStore = defineStore('district', () => {
  const userStore = useUserStore()

  // ADMIN 可自由切换区县（null = 全部）；非 ADMIN 锁定到自身区县
  const _selected = ref<string | null>(
    localStorage.getItem(STORAGE_KEY) ?? null
  )

  const isAdmin = computed(() => userStore.isAdmin())

  // 当前展示用区县（用于 UI 显示）
  const currentDistrict = computed<string | null>(() => {
    if (isAdmin.value) return _selected.value
    return userStore.userInfo?.district ?? '射洪市'
  })

  // API 传参用（null 表示不传 district，即全量）
  const apiDistrict = computed<string | null>(() => {
    if (isAdmin.value) return _selected.value   // null = 全量
    return userStore.userInfo?.district ?? '射洪市'
  })

  function setDistrict(d: string | null) {
    if (!isAdmin.value) return
    _selected.value = d
    if (d === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, d)
    }
  }

  // 非 ADMIN 登录后清除缓存的 admin 选项
  watch(isAdmin, (admin) => {
    if (!admin) {
      _selected.value = null
      localStorage.removeItem(STORAGE_KEY)
    }
  })

  return { DISTRICTS, currentDistrict, apiDistrict, isAdmin, setDistrict }
})
