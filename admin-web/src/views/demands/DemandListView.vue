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
          <el-descriptions-item label="开通方式" v-if="currentDemand.status === '已开通' && currentDemand.completionModeLabel">
            <el-tag type="success" size="small">{{ currentDemand.completionModeLabel }}</el-tag>
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
          <el-descriptions-item
            label="完工位置"
            :span="2"
            v-if="currentDemand.constructionLat != null && currentDemand.constructionLng != null"
          >
            {{ currentDemand.constructionLat }}, {{ currentDemand.constructionLng }}
          </el-descriptions-item>
          <el-descriptions-item
            label="完工位置详细描述"
            :span="2"
            v-if="currentDemand.constructionLocationDetail"
          >
            {{ currentDemand.constructionLocationDetail }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2" v-if="currentDemand.remark">{{ currentDemand.remark }}</el-descriptions-item>
          <el-descriptions-item label="驳回原因" :span="2" v-if="currentDemand.rejectionReason">
            <span style="color: #F56C6C;">{{ currentDemand.rejectionReason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="跨区审核人" v-if="currentDemand.crossAreaReviewerId">
            {{ getUsername(currentDemand.crossAreaReviewerId) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider>现场照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">需求提交时上传的现场照片，支持点击查看大图。</div>
          <div v-if="sitePhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in sitePhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="sitePhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty v-else description="暂无现场照片" :image-size="72" />
        </div>

        <el-divider>现有资源照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">设计查勘阶段上传的现有资源照片，支持点击查看大图。</div>
          <div v-if="resourcePhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in resourcePhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="resourcePhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty
            v-else
            :description="currentDemand.hasResource ? '暂无现有资源照片' : '该工单不是现有资源场景'"
            :image-size="72"
          />
        </div>

        <el-divider>施工照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">施工完工阶段上传的现场施工照片，支持点击查看大图。</div>
          <div v-if="constructionPhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in constructionPhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="constructionPhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty v-else description="暂无施工照片" :image-size="72" />
        </div>

        <template v-if="designImageUrls.length || designFileLinks.length">
          <el-divider>设计文件</el-divider>

          <div v-if="designImageUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in designImageUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="designImageUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>

          <div v-if="designFileLinks.length" class="file-link-list">
            <el-link
              v-for="file in designFileLinks"
              :key="file.url"
              :href="file.url"
              target="_blank"
              type="primary"
              class="file-link-item"
            >
              {{ file.name }}
            </el-link>
          </div>
        </template>

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
import { computed, ref, onMounted, watch } from 'vue'
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
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const searchStage = ref('') // ''=全部, pending=待审核, design=设计阶段, construction=施工阶段, opened=已开通
const searchType = ref('')
const searchArea = ref('')
const searchDateRange = ref<[string, string] | null>(null)

const demandList = ref<Demand[]>([])

const normalizeAttachmentUrl = (url?: string) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`
  const serverBaseUrl = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return serverBaseUrl ? `${serverBaseUrl}${normalizedUrl}` : normalizedUrl
}

const getFileNameFromUrl = (url: string) => {
  const pathname = url.split('?')[0]
  return pathname.split('/').pop() || '附件'
}

const isImageFile = (url: string) => {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url.split('?')[0])
}

const resourcePhotoUrls = computed(() => {
  return (currentDemand.value?.resourcePhotos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const sitePhotoUrls = computed(() => {
  return (currentDemand.value?.photos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const constructionPhotoUrls = computed(() => {
  return (currentDemand.value?.constructionPhotos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const normalizedDesignFileUrls = computed(() => {
  return (currentDemand.value?.designFiles || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const designImageUrls = computed(() => {
  return normalizedDesignFileUrls.value.filter((url) => isImageFile(url))
})

const designFileLinks = computed(() => {
  return normalizedDesignFileUrls.value
    .filter((url) => !isImageFile(url))
    .map((url) => ({
      url,
      name: getFileNameFromUrl(url)
    }))
})

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

.detail-section {
  margin-bottom: 4px;
}

.section-caption {
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #909399;
}

.photo-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.detail-photo {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #f5f7fa;
}

.file-link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.file-link-item {
  max-width: 100%;
}

:deep(.el-table) { font-size: 14px; }
:deep(.el-table th) { font-size: 14px; font-weight: bold; }
:deep(.el-table td) { padding: 10px 0; }
</style>
