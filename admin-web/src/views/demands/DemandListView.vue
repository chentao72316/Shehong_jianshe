<template>
  <div class="demand-list-view">
    <!-- 搜索栏 -->
    <el-card class="search-bar">
      <el-row :gutter="12" align="middle">
        <el-col :span="5">
          <el-input
            v-model="searchKeyword"
            placeholder="工单编号 / 申请人 / 位置"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :span="8">
          <el-radio-group v-model="searchStage" size="default" @change="handleSearch">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="pending">待审核</el-radio-button>
            <el-radio-button value="design">设计阶段</el-radio-button>
            <el-radio-button value="construction">施工阶段</el-radio-button>
            <el-radio-button value="opened">已开通</el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :span="3">
          <el-select v-model="searchType" placeholder="需求类型" clearable @change="handleSearch" style="width: 100%">
            <el-option label="新建" value="新建" />
            <el-option label="扩容" value="扩容" />
            <el-option label="改造" value="改造" />
            <el-option label="应急" value="应急" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-input v-model="searchArea" placeholder="受理区域" clearable @clear="handleSearch" @keyup.enter="handleSearch" />
        </el-col>
      </el-row>
      <el-row :gutter="12" align="middle" style="margin-top: 10px;">
        <el-col :span="10">
          <el-date-picker
            v-model="searchDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="提交开始日期"
            end-placeholder="提交结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleSearch"
            clearable
            style="width: 100%"
          />
        </el-col>
        <el-col :span="14">
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" :loading="exporting" @click="handleExport">导出 Excel</el-button>
          <span class="total-tip">共 {{ total }} 条</span>
        </el-col>
      </el-row>
    </el-card>

    <!-- 工单列表 -->
    <el-card>
      <el-table :data="demandList" v-loading="loading" stripe>
        <el-table-column prop="demandNo" label="工单编号" width="170" fixed="left" />
        <el-table-column prop="acceptArea" label="受理区域" width="140" />
        <el-table-column prop="gridName" label="网格" width="140" show-overflow-tooltip />
        <el-table-column prop="businessType" label="业务" width="70" />
        <el-table-column prop="type" label="类型" width="70" />
        <el-table-column label="状态" width="130" fixed="left">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="紧急度" width="80">
          <template #default="{ row }">
            <el-tag :type="getUrgencyType(row.urgency)" size="small">{{ row.urgency }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请人" width="100">
          <template #default="{ row }">
            {{ row.demandPersonName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="提交人" width="100">
          <template #default="{ row }">
            {{ getUsername(row.createdBy) }}
          </template>
        </el-table-column>
        <el-table-column label="设计单位" width="100">
          <template #default="{ row }">
            {{ getUsername(row.assignedDesignUnit) || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="locationDetail" label="位置" show-overflow-tooltip min-width="160" />
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleDetail(row)">详情</el-button>
            <el-button v-if="isAdmin" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadDemands"
        @size-change="handlePageSizeChange"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="工单详情" width="800px" top="5vh">
      <template v-if="currentDemand">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="工单编号" :span="2">{{ currentDemand.demandNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentDemand.status)">{{ currentDemand.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="紧急度">
            <el-tag :type="getUrgencyType(currentDemand.urgency)" size="small">{{ currentDemand.urgency }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="受理区域">{{ currentDemand.acceptArea }}</el-descriptions-item>
          <el-descriptions-item label="提交网格">{{ currentDemand.gridName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="业务类型">{{ currentDemand.businessType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="需求类型">{{ currentDemand.type }}</el-descriptions-item>
          <el-descriptions-item label="网络支撑中心">{{ currentDemand.networkSupport || '-' }}</el-descriptions-item>
          <el-descriptions-item label="服务中心">{{ currentDemand.serviceCenter || '-' }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ currentDemand.demandPersonName }}</el-descriptions-item>
          <el-descriptions-item label="申请人电话">{{ currentDemand.demandPersonPhone }}</el-descriptions-item>
          <el-descriptions-item label="提交人">{{ getUsername(currentDemand.createdBy) }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatDate(currentDemand.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="设计单位">{{ getUsername(currentDemand.assignedDesignUnit) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="施工单位">{{ getUsername(currentDemand.assignedConstructionUnit) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="预约客户数">{{ currentDemand.reservedCustomers ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="驳回次数" v-if="currentDemand.rejectCount">{{ currentDemand.rejectCount }}</el-descriptions-item>
          <el-descriptions-item label="位置" :span="2">{{ currentDemand.locationDetail || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2" v-if="currentDemand.remark">{{ currentDemand.remark }}</el-descriptions-item>
          <el-descriptions-item label="驳回原因" :span="2" v-if="currentDemand.rejectionReason">
            <span style="color: #F56C6C;">{{ currentDemand.rejectionReason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="跨区审核人" v-if="currentDemand.crossAreaReviewerId">
            {{ getUsername(currentDemand.crossAreaReviewerId) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>流程记录</el-divider>
        <el-timeline v-if="currentDemand.logs?.length">
          <el-timeline-item
            v-for="(log, index) in currentDemand.logs"
            :key="index"
            :timestamp="formatDate(log.time || log.createdAt)"
            placement="top"
          >
            <span style="font-size:13px;">{{ log.content || log.action }}</span>
            <span v-if="log.operator || log.operatorName" style="margin-left:8px; color:#909399; font-size:12px;">
              — {{ log.operator || log.operatorName }}
            </span>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无流程记录" />
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getDemandList, getDemandDetail, exportDemands, deleteDemand } from '@/api/demand'
import { useUserStore } from '@/stores/user'
import { useDistrictStore } from '@/stores/district'
import type { Demand } from '@/types'

const userStore = useUserStore()
const districtStore = useDistrictStore()
const isAdmin = userStore.isAdmin()

const loading = ref(false)
const exporting = ref(false)
const detailVisible = ref(false)
const currentDemand = ref<Demand | null>(null)

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const searchStage = ref('') // ''=全部, pending=待审核, design=设计阶段, construction=施工阶段, opened=已开通
const searchType = ref('')
const searchArea = ref('')
const searchDateRange = ref<[string, string] | null>(null)

const demandList = ref<Demand[]>([])

// 阶段 -> 状态映射
const stageStatusMap: Record<string, string[]> = {
  pending: ['待审核'],
  design: ['设计中'],
  construction: ['施工中', '待确认'],
  opened: ['已开通']
}

const getStatusType = (status: string) => {
  if (status === '待审核' || status === '待确认') return 'warning'
  if (status === '已开通') return 'success'
  if (status === '已驳回') return 'danger'
  return ''
}

const getUrgencyType = (urgency: string) => {
  if (urgency === '紧急') return 'warning'
  if (urgency === '特急') return 'danger'
  return 'info'
}

const getUsername = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'object' && val.name) return val.name
  if (typeof val === 'string') return val
  return ''
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const loadDemands = async () => {
  loading.value = true
  try {
    const data = await getDemandList({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
      status: searchStage.value ? stageStatusMap[searchStage.value] : undefined,
      type: searchType.value || undefined,
      area: searchArea.value || undefined,
      dateFrom: searchDateRange.value?.[0] || undefined,
      dateTo: searchDateRange.value?.[1] || undefined,
      district: districtStore.apiDistrict ?? undefined,
    })
    demandList.value = data.list
    total.value = data.total
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadDemands()
}

const handleReset = () => {
  searchKeyword.value = ''
  searchStage.value = ''
  searchType.value = ''
  searchArea.value = ''
  searchDateRange.value = null
  currentPage.value = 1
  loadDemands()
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  loadDemands()
}

const handleDetail = async (row: Demand) => {
  try {
    currentDemand.value = await getDemandDetail(row.id || (row as any)._id)
    detailVisible.value = true
  } catch (error) {
    console.error(error)
  }
}

const handleExport = async () => {
  exporting.value = true
  try {
    await exportDemands({
      keyword: searchKeyword.value || undefined,
      status: searchStage.value ? stageStatusMap[searchStage.value] : undefined,
      type: searchType.value || undefined,
      area: searchArea.value || undefined,
      dateFrom: searchDateRange.value?.[0] || undefined,
      dateTo: searchDateRange.value?.[1] || undefined,
      district: districtStore.apiDistrict ?? undefined,
    })
  } catch {
    ElMessage.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

const handleDelete = async (row: Demand) => {
  const id = row.id || (row as any)._id
  try {
    await ElMessageBox.confirm(`确定删除工单「${row.demandNo}」吗？删除后不可恢复。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteDemand(id)
    ElMessage.success('删除成功')
    loadDemands()
  } catch {
    // 用户取消或删除失败已在拦截器处理
  }
}

onMounted(() => {
  loadDemands()
})

// 区县切换时重置并刷新
watch(() => districtStore.apiDistrict, () => {
  currentPage.value = 1
  loadDemands()
})
</script>

<style scoped>
.demand-list-view {
  max-width: 1600px;
}

.search-bar {
  margin-bottom: 20px;
}

.total-tip {
  margin-left: 12px;
  font-size: 14px;
  color: #909399;
}

:deep(.el-table) { font-size: 14px; }
:deep(.el-table th) { font-size: 14px; font-weight: bold; }
:deep(.el-table td) { padding: 10px 0; }
</style>
