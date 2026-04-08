<template>
  <div class="timeout-view">
    <!-- 搜索栏 -->
    <el-card class="search-bar">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-select v-model="searchArea" placeholder="选择区域" clearable @change="handleSearch">
            <el-option v-for="area in areaOptions" :key="area" :label="area" :value="area" />
          </el-select>
        </el-col>
        <el-col :span="5">
          <el-select v-model="searchTimeoutType" placeholder="超时类型" clearable @change="handleSearch">
            <el-option label="设计超时" value="设计中" />
            <el-option label="施工超时" value="施工中" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-button type="primary" @click="handleSearch">搜索</el-button>
        </el-col>
        <el-col :span="9" style="text-align: right;">
          <el-tag type="danger" style="font-size: 13px;">超时工单共 {{ total }} 条</el-tag>
        </el-col>
      </el-row>
    </el-card>

    <!-- 超时列表 -->
    <el-card>
      <el-table :data="timeoutList" v-loading="loading" stripe>
        <el-table-column prop="demandNo" label="工单编号" width="165" />
        <el-table-column prop="acceptArea" label="区域" width="110" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="70" />
        <el-table-column prop="urgency" label="紧急度" width="80">
          <template #default="{ row }">
            <el-tag :type="getUrgencyType(row.urgency)" size="small">{{ row.urgency }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="超时类型" width="100">
          <template #default="{ row }">
            <el-tag type="danger" size="small">{{ row.timeoutType || (row.status === '设计中' ? '设计超时' : '施工超时') }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="超时天数" width="100">
          <template #default="{ row }">
            <span class="timeout-days">+{{ row.timeoutDays ?? 0 }}天</span>
          </template>
        </el-table-column>
        <el-table-column prop="demandPersonName" label="申请人" width="80" />
        <el-table-column label="责任单位" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.status === '设计中'">{{ getUnitName(row.assignedDesignUnit) }}</span>
            <span v-else>{{ getUnitName(row.assignedConstructionUnit) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleRemind(row)">催办</el-button>
            <el-button type="warning" link size="small" @click="handleRemark(row)">备注</el-button>
            <el-button type="danger" link size="small" @click="handleForce(row)">强制状态</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadTimeout"
        @size-change="handlePageSizeChange"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 备注弹窗 -->
    <el-dialog v-model="remarkVisible" title="添加备注" width="400px">
      <el-form :model="remarkForm" label-width="80px">
        <el-form-item label="工单编号">
          <span>{{ currentDemand?.demandNo }}</span>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="remarkForm.remark" type="textarea" :rows="4" placeholder="请输入备注内容" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="remarkVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveRemark">保存</el-button>
      </template>
    </el-dialog>

    <!-- 强制状态弹窗 -->
    <el-dialog v-model="forceVisible" title="强制变更状态" width="400px">
      <el-form label-width="80px">
        <el-form-item label="工单编号">
          <span>{{ currentDemand?.demandNo }}</span>
        </el-form-item>
        <el-form-item label="当前状态">
          <el-tag type="danger">{{ currentDemand?.status }}</el-tag>
        </el-form-item>
        <el-form-item label="目标状态">
          <el-select v-model="forceForm.status" placeholder="请选择目标状态">
            <el-option label="待审核" value="待审核" />
            <el-option label="设计中" value="设计中" />
            <el-option label="施工中" value="施工中" />
            <el-option label="待确认" value="待确认" />
            <el-option label="已开通" value="已开通" />
            <el-option label="已驳回" value="已驳回" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="forceVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveForce">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getTimeoutList, sendRemind } from '@/api/timeout'
import { addRemark, forceStatus } from '@/api/intervene'
import { getAreaConfigList } from '@/api/area-config'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Demand } from '@/types'
import { useDistrictStore } from '@/stores/district'

const districtStore = useDistrictStore()

interface TimeoutDemandItem extends Demand {
  timeoutDays: number
  timeoutType: string
}

const loading = ref(false)
const saving = ref(false)
const remarkVisible = ref(false)
const forceVisible = ref(false)

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchArea = ref('')
const searchTimeoutType = ref('')

const timeoutList = ref<TimeoutDemandItem[]>([])
const currentDemand = ref<TimeoutDemandItem | null>(null)
const areaOptions = ref<string[]>([])

const remarkForm = reactive({ remark: '' })
const forceForm = reactive({ status: '' })

const getUrgencyType = (urgency: string) => {
  if (urgency === '特急') return 'danger'
  if (urgency === '紧急') return 'warning'
  return 'info'
}

const getUnitName = (unit: any) => {
  if (!unit) return '-'
  if (typeof unit === 'object') return unit.name || '-'
  return unit
}

const handleSearch = () => {
  currentPage.value = 1
  loadTimeout()
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  loadTimeout()
}

const loadTimeout = async () => {
  loading.value = true
  try {
    const params: any = {
      page: currentPage.value,
      pageSize: pageSize.value
    }
    if (searchArea.value) params.area = searchArea.value
    if (districtStore.apiDistrict) params.district = districtStore.apiDistrict
    // 超时类型过滤通过area-based查询实现，此处前端二次过滤
    const data = await getTimeoutList(params)
    let list = data.list as TimeoutDemandItem[]
    if (searchTimeoutType.value) {
      list = list.filter(d => d.status === searchTimeoutType.value)
    }
    timeoutList.value = list
    total.value = data.total
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadAreaOptions = async () => {
  try {
    const params = districtStore.apiDistrict ? { district: districtStore.apiDistrict } : undefined
    const data = await getAreaConfigList(params)
    areaOptions.value = (data.list || [])
      .filter((a: any) => a.active !== false)
      .map((a: any) => a.acceptArea)
  } catch {
    // 加载失败时使用空列表，不阻断页面
  }
}

const handleRemind = async (row: TimeoutDemandItem) => {
  try {
    await ElMessageBox.confirm(
      `确定向【${row.demandNo}】（${row.timeoutType}，已超 ${row.timeoutDays} 天）的责任单位发送催办？`,
      '催办确认'
    )
    await sendRemind(row.id)
    ElMessage.success('催办提醒已发送')
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleRemark = (row: TimeoutDemandItem) => {
  currentDemand.value = row
  remarkForm.remark = ''
  remarkVisible.value = true
}

const handleSaveRemark = async () => {
  if (!currentDemand.value || !remarkForm.remark) {
    ElMessage.warning('请输入备注内容')
    return
  }
  saving.value = true
  try {
    await addRemark(currentDemand.value.id, remarkForm.remark)
    ElMessage.success('备注添加成功')
    remarkVisible.value = false
  } catch (error) {
    console.error(error)
  } finally {
    saving.value = false
  }
}

const handleForce = (row: TimeoutDemandItem) => {
  currentDemand.value = row
  forceForm.status = ''
  forceVisible.value = true
}

const handleSaveForce = async () => {
  if (!currentDemand.value || !forceForm.status) {
    ElMessage.warning('请选择目标状态')
    return
  }
  try {
    await ElMessageBox.confirm('强制变更状态可能影响业务流程，确认继续？', '警告', {
      type: 'warning'
    })
    await forceStatus(currentDemand.value.id, forceForm.status)
    ElMessage.success('状态变更成功')
    forceVisible.value = false
    loadTimeout()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

onMounted(() => {
  loadAreaOptions()
  loadTimeout()
})

// 区县切换时刷新
watch(() => districtStore.apiDistrict, () => {
  currentPage.value = 1
  searchArea.value = ''
  loadAreaOptions()
  loadTimeout()
})
</script>

<style scoped>
.timeout-view {
  max-width: 1400px;
}

.search-bar {
  margin-bottom: 20px;
}

.timeout-days {
  color: #F56C6C;
  font-weight: bold;
  font-size: 14px;
}
</style>
