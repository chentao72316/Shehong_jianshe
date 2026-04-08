<template>
  <div class="role-config-view">
    <el-card class="tip-card">
      <el-alert
        title="说明：配置各角色在工单列表中的可见范围，修改后立即生效。gridName 含「网络建设中心」的用户始终可见全部工单，不受此配置影响。"
        type="info"
        :closable="false"
        show-icon
      />
    </el-card>

    <el-card v-loading="loading">
      <el-table :data="list" stripe>
        <el-table-column prop="label" label="角色名称" width="140" />
        <el-table-column prop="role" label="角色代码" width="180" />
        <el-table-column label="可见范围" width="120">
          <template #default="{ row }">
            <el-tag :type="scopeTagType(row.visibilityScope)">
              {{ scopeLabels[row.visibilityScope] || row.visibilityScope }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">修改</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" title="修改角色可见范围" width="520px">
      <el-descriptions :column="1" border size="small" style="margin-bottom: 20px;">
        <el-descriptions-item label="角色">{{ editItem?.label }}（{{ editItem?.role }}）</el-descriptions-item>
      </el-descriptions>
      <el-form label-width="90px">
        <el-form-item label="可见范围">
          <el-radio-group v-model="editScope">
            <div class="scope-options">
              <el-radio
                v-for="opt in scopeOptions"
                :key="opt.value"
                :label="opt.value"
                class="scope-radio"
              >
                <span class="scope-radio-label">{{ opt.label }}</span>
                <span class="scope-radio-desc">{{ opt.desc }}</span>
              </el-radio>
            </div>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getRoleConfigList, saveRoleConfig } from '@/api'
import { ElMessage } from 'element-plus'
import type { RoleConfig } from '@/types'

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const list = ref<RoleConfig[]>([])
const editItem = ref<RoleConfig | null>(null)
const editScope = ref('')

const scopeLabels: Record<string, string> = {
  all: '全部',
  area: '区域',
  grid: '网格',
  self: '仅自己',
  assigned: '指派给我'
}

const scopeOptions = [
  { value: 'all',      label: '全部',     desc: '可见所有工单，无限制' },
  { value: 'area',     label: '区域',     desc: '只见本支撑区域（acceptArea = user.area）的工单' },
  { value: 'grid',     label: '网格',     desc: '只见本网格提交 + 受理区域在本网格的工单' },
  { value: 'self',     label: '仅自己',   desc: '只见自己创建的工单' },
  { value: 'assigned', label: '指派给我', desc: '只见指派给自己的工单（设计/施工/监理适用）' }
]

const scopeTagType = (scope: string) => {
  const map: Record<string, string> = {
    all: 'danger', area: '', grid: 'warning', self: 'info', assigned: 'success'
  }
  return map[scope] || 'info'
}

const loadList = async () => {
  loading.value = true
  try {
    const res = await getRoleConfigList()
    list.value = res.list || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const handleEdit = (row: RoleConfig) => {
  editItem.value = row
  editScope.value = row.visibilityScope
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!editItem.value) return
  saving.value = true
  try {
    await saveRoleConfig({ role: editItem.value.role, visibilityScope: editScope.value })
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadList()
  } catch (e) {
    console.error(e)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.role-config-view {
  max-width: 1000px;
}

.tip-card {
  margin-bottom: 20px;
}

.scope-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.scope-radio {
  display: flex;
  align-items: baseline;
  gap: 8px;
  height: auto;
  line-height: 1.6;
}

.scope-radio-label {
  font-weight: 500;
  color: #303133;
  min-width: 60px;
}

.scope-radio-desc {
  font-size: 13px;
  color: #909399;
}

:deep(.el-table) { font-size: 15px; }
:deep(.el-table th) { font-size: 15px; font-weight: bold; }
:deep(.el-table td) { padding: 12px 0; }
:deep(.el-radio__label) { display: flex; align-items: baseline; gap: 8px; }
</style>
