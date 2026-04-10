<template>
  <div class="dashboard">
    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stat-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-value">{{ overview.total }}</div>
          <div class="stat-label">总需求</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-progress">
          <div class="stat-value">{{ overview.inProgress }}</div>
          <div class="stat-label">进行中</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-timeout">
          <div class="stat-value">{{ overview.timeout }}</div>
          <div class="stat-label">已超时</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-completed">
          <div class="stat-value">{{ overview.completed }}</div>
          <div class="stat-label">已完成</div>
        </div>
      </el-col>
    </el-row>

    <el-alert
      v-if="scopeNotice"
      :title="scopeNotice.title"
      :description="scopeNotice.description"
      type="info"
      show-icon
      :closable="false"
      class="scope-notice"
    />

    <!-- 快捷入口 -->
    <el-row :gutter="20" class="shortcut-row">
      <el-col v-for="item in shortcuts" :key="item.label" :span="6">
        <div class="shortcut-card" @click="router.push(item.path)">
          <el-icon class="shortcut-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </div>
      </el-col>
    </el-row>

    <el-row v-if="focusCards.length" :gutter="20" class="focus-row">
      <el-col v-for="item in focusCards" :key="item.label" :span="6">
        <div class="focus-card" @click="router.push(item.to)">
          <div class="focus-header">
            <span class="focus-label">{{ item.label }}</span>
            <span class="focus-value">{{ item.value }}</span>
          </div>
          <div class="focus-desc">{{ item.description }}</div>
        </div>
      </el-col>
    </el-row>

    <!-- 超时需求列表 -->
    <el-card class="timeout-list">
      <template #header>
        <div class="card-header">
          <span>超时需求</span>
          <el-button type="primary" link @click="$router.push('/timeout')">查看更多</el-button>
        </div>
      </template>
      <el-table :data="timeoutList" stripe>
        <el-table-column prop="demandNo" label="工单编号" width="180" />
        <el-table-column prop="acceptArea" label="区域" width="120" />
        <el-table-column prop="status" label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="demandPersonName" label="申请人" width="100" />
        <el-table-column label="操作">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleRemind(row)">催办</el-button>
            <el-button type="primary" link size="small" @click="handleIntervene(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminOverview, getTimeoutList, sendRemind } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Document, Clock, PieChart } from '@element-plus/icons-vue'
import type { AdminOverview, Demand } from '@/types'
import { useDistrictStore } from '@/stores/district'
import { useUserStore } from '@/stores/user'

const districtStore = useDistrictStore()
const userStore = useUserStore()

const overview = ref<AdminOverview>({
  total: 0,
  pending: 0,
  inProgress: 0,
  completed: 0,
  timeout: 0,
  userCount: 0
})

const router = useRouter()
const timeoutList = ref<Demand[]>([])
const scopeNotice = computed(() => {
  const district = districtStore.currentDistrict || userStore.userInfo?.district || '射洪市'

  if (userStore.isDistrictAdmin()) {
    return {
      title: '当前统计范围：本区县',
      description: `当前首页统计、超时列表和快捷入口均按区县“${district}”过滤。`
    }
  }

  if (userStore.isNetworkManager()) {
    const networkCenter = userStore.userInfo?.gridName || '未配置网络支撑中心'
    const area = userStore.userInfo?.area || '未配置区域'
    return {
      title: '当前统计范围：本区域',
      description: `当前首页统计按网络支撑中心“${networkCenter}”负责的受理区域展示；账号归属区域为“${area}”。`
    }
  }

  return null
})

const shortcuts = computed(() => {
  const items = [
    { path: '/staff', label: '人员配置', icon: User, visible: userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER']) },
    { path: '/demands', label: '工单列表', icon: Document, visible: true },
    { path: '/timeout', label: '超时督办', icon: Clock, visible: userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER']) },
    { path: '/stats', label: '统计报表', icon: PieChart, visible: userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER']) }
  ]
  return items.filter((item) => item.visible)
})

const focusCards = computed(() => {
  if (!userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER', 'LEVEL4_MANAGER', 'NETWORK_MANAGER'])) {
    return []
  }

  return [
    {
      label: userStore.isNetworkManager() ? '待确认工单' : '待审核工单',
      value: overview.value.pending,
      description: userStore.isNetworkManager() ? '直接进入待确认阶段工单' : '直接进入待审核阶段工单',
      to: { path: '/demands', query: { stage: 'pending' } }
    },
    {
      label: '设计阶段',
      value: overview.value.designCount || 0,
      description: '查看当前设计阶段工单',
      to: { path: '/demands', query: { stage: 'design' } }
    },
    {
      label: '施工阶段',
      value: overview.value.constructionCount || 0,
      description: '查看当前施工阶段工单',
      to: { path: '/demands', query: { stage: 'construction' } }
    },
    {
      label: '超时工单',
      value: overview.value.timeout,
      description: '直接进入仅超时工单视图',
      to: { path: '/demands', query: { overdueOnly: '1' } }
    }
  ]
})

const getStatusType = (status: string) => {
  if (status.includes('超时')) return 'danger'
  if (status === '已开通') return 'success'
  if (status === '已驳回') return 'warning'
  return 'info'
}

const loadData = async () => {
  try {
    const district = districtStore.apiDistrict ?? undefined
    const [overviewData, timeoutData] = await Promise.all([
      getAdminOverview({ district }),
      getTimeoutList({ pageSize: 5, district })
    ])
    overview.value = overviewData
    timeoutList.value = timeoutData.list
  } catch (error) {
    console.error(error)
  }
}

watch(() => districtStore.apiDistrict, () => { loadData() })

const handleRemind = async (row: Demand) => {
  try {
    await ElMessageBox.confirm(`确定向 ${row.demandNo} 发送催办提醒吗？`, '催办确认')
    await sendRemind(row.id)
    ElMessage.success('催办提醒已发送')
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleIntervene = (row: Demand) => {
  const detailId = row.id || (row as Demand & { _id?: string })._id || ''
  router.push({
    path: '/demands',
    query: {
      keyword: row.demandNo,
      detailId
    }
  })
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
}

.stat-row {
  margin-bottom: 20px;
}

.scope-notice {
  margin-bottom: 20px;
}

.stat-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #303133;
}

.stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 8px;
}

.stat-progress .stat-value {
  color: #409EFF;
}

.stat-timeout .stat-value {
  color: #F56C6C;
}

.stat-completed .stat-value {
  color: #67C23A;
}

.shortcut-row {
  margin-bottom: 20px;
}

.focus-row {
  margin-bottom: 20px;
}

.shortcut-card {
  background: #fff;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.shortcut-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.shortcut-icon {
  font-size: 32px;
  color: #409EFF;
}

.shortcut-card span {
  font-size: 14px;
  color: #606266;
}

.focus-card {
  background: linear-gradient(135deg, #f8fbff 0%, #eef5ff 100%);
  border: 1px solid #dbe8ff;
  border-radius: 10px;
  padding: 18px 20px;
  cursor: pointer;
  transition: all 0.3s;
}

.focus-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.12);
}

.focus-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.focus-label {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.focus-value {
  font-size: 24px;
  font-weight: 700;
  color: #409EFF;
}

.focus-desc {
  margin-top: 10px;
  font-size: 13px;
  line-height: 1.6;
  color: #606266;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

