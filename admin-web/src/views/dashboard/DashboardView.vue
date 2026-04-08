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

    <!-- 快捷入口 -->
    <el-row :gutter="20" class="shortcut-row">
      <el-col :span="6">
        <div class="shortcut-card" @click="$router.push('/staff')">
          <el-icon class="shortcut-icon"><User /></el-icon>
          <span>人员配置</span>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="shortcut-card" @click="$router.push('/demands')">
          <el-icon class="shortcut-icon"><Document /></el-icon>
          <span>需求列表</span>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="shortcut-card" @click="$router.push('/timeout')">
          <el-icon class="shortcut-icon"><Clock /></el-icon>
          <span>超时督办</span>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="shortcut-card" @click="$router.push('/stats')">
          <el-icon class="shortcut-icon"><PieChart /></el-icon>
          <span>统计报表</span>
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
            <el-button type="primary" link size="small" @click="handleIntervene(row)">干预</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminOverview, getTimeoutList, sendRemind } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Document, Clock, PieChart } from '@element-plus/icons-vue'
import type { AdminOverview, Demand } from '@/types'
import { useDistrictStore } from '@/stores/district'

const districtStore = useDistrictStore()

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
    await ElMessageBox.confirm(`确定向 ${row.demandNo} 发送催办提醒？`, '催办确认')
    await sendRemind(row.id)
    ElMessage.success('催办提醒已发送')
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleIntervene = (row: Demand) => {
  router.push(`/demands/${row.id}`)
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

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
