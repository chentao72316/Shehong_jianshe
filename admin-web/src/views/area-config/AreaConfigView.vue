<template>
  <div class="area-config-view">
    <el-card class="toolbar-card">
      <el-button v-if="canManageAreaConfig" type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增区域配置
      </el-button>
      <span class="count-tip">共 {{ list.length }} 条区域配置</span>
    </el-card>

    <el-card v-loading="loading">
      <el-table :data="list" stripe>
        <el-table-column prop="district" label="区县" width="100" />
        <el-table-column prop="acceptArea" label="受理区域" width="160" />
        <el-table-column prop="networkCenter" label="网络支撑中心" width="160" />
        <el-table-column label="设计候选人" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="u in row.designCandidates"
              :key="u._id"
              size="small"
              type="info"
              style="margin-right: 4px; margin-bottom: 2px;"
            >{{ u.name }}</el-tag>
            <span v-if="!row.designCandidates?.length" class="text-placeholder">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="施工候选人" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="u in row.constructionCandidates"
              :key="u._id"
              size="small"
              type="success"
              style="margin-right: 4px; margin-bottom: 2px;"
            >{{ u.name }}</el-tag>
            <span v-if="!row.constructionCandidates?.length" class="text-placeholder">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="监理候选人" min-width="180">
          <template #default="{ row }">
            <el-tag
              v-for="u in row.supervisorCandidates"
              :key="u._id"
              size="small"
              type="warning"
              style="margin-right: 4px; margin-bottom: 2px;"
            >{{ u.name }}</el-tag>
            <span v-if="!row.supervisorCandidates?.length" class="text-placeholder">未配置</span>
          </template>
        </el-table-column>
        <el-table-column label="确认经理" width="120">
          <template #default="{ row }">
            <span v-if="row.networkManagerId">{{ row.networkManagerId.name }}</span>
            <span v-else class="text-placeholder">未配置</span>
          </template>
        </el-table-column>
        <el-table-column prop="active" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'danger'" size="small">
              {{ row.active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="canManageAreaConfig" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <span v-else class="text-placeholder">只读</span>
            <el-button v-if="canManageAreaConfig" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑区域配置' : '新增区域配置'" width="700px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px" size="default">
        <el-form-item label="区县" prop="district">
          <el-select v-model="form.district" style="width: 100%" :disabled="isEdit || !userStore.isAdmin()">
            <el-option v-for="d in ['射洪市', '蓬溪县', '大英县', '船山区', '安居区']" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="受理区域" prop="acceptArea">
          <el-select
            v-model="form.acceptArea"
            filterable
            allow-create
            default-first-option
            placeholder="请选择或输入受理区域（单位/部门/网格）"
            style="width: 100%"
            :disabled="isEdit"
          >
            <el-option v-for="name in gridNameOptions" :key="name" :label="name" :value="name" />
          </el-select>
          <div class="form-tip">从已登记的单位/部门/网格中选择，或直接输入新区域名称</div>
        </el-form-item>
        <el-form-item label="网络支撑中心">
          <el-select
            v-model="form.networkCenter"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="请选择或输入网络支撑中心名称"
            style="width: 100%"
          >
            <el-option v-for="name in networkCenterOptions" :key="name" :label="name" :value="name" />
          </el-select>
          <div class="form-tip">从已有配置中选择，或直接输入新名称</div>
        </el-form-item>
        <el-form-item label="设计候选人">
          <el-select
            v-model="form.designCandidates"
            multiple
            filterable
            placeholder="请选择设计候选人（可多选）"
            style="width: 100%"
          >
            <el-option
              v-for="u in designStaff"
              :key="u.id"
              :label="`${u.name}（${u.phone}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="施工候选人">
          <el-select
            v-model="form.constructionCandidates"
            multiple
            filterable
            placeholder="请选择施工候选人（可多选）"
            style="width: 100%"
          >
            <el-option
              v-for="u in constructionStaff"
              :key="u.id"
              :label="`${u.name}（${u.phone}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="监理候选人">
          <el-select
            v-model="form.supervisorCandidates"
            multiple
            filterable
            placeholder="请选择监理候选人（可多选）"
            style="width: 100%"
          >
            <el-option
              v-for="u in supervisorStaff"
              :key="u.id"
              :label="`${u.name}（${u.phone}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="确认经理">
          <el-select
            v-model="form.networkManagerId"
            filterable
            clearable
            placeholder="请选择网络支撑经理（单选）"
            style="width: 100%"
          >
            <el-option
              v-for="u in networkManagerStaff"
              :key="u.id"
              :label="`${u.name}（${u.phone}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="canManageAreaConfig" type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getAreaConfigList, saveAreaConfig, deleteAreaConfig, getStaffList, getStaffDistinct } from '@/api'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { AreaConfig, StaffMember } from '@/types'
import { useDistrictStore } from '@/stores/district'
import { useUserStore } from '@/stores/user'

const districtStore = useDistrictStore()
const userStore = useUserStore()
const canManageAreaConfig = userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER'])

const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()

const list = ref<AreaConfig[]>([])

// 各角色人员列表（用于下拉选择）
const designStaff = ref<StaffMember[]>([])
const constructionStaff = ref<StaffMember[]>([])
const supervisorStaff = ref<StaffMember[]>([])
const networkManagerStaff = ref<StaffMember[]>([])

// 受理区域候选选项（从已登记的单位/网格中取）
const gridNameOptions = ref<string[]>([])
// 网络支撑中心候选选项（从已有配置中取）
const networkCenterOptions = ref<string[]>([])

const form = reactive({
  district: '射洪市',
  acceptArea: '',
  networkCenter: '',
  designCandidates: [] as string[],
  constructionCandidates: [] as string[],
  supervisorCandidates: [] as string[],
  networkManagerId: '' as string,
  active: true
})

const rules: FormRules = {
  acceptArea: [{ required: true, message: '请输入受理区域名称', trigger: 'blur' }]
}

const loadList = async () => {
  loading.value = true
  try {
    const params = districtStore.apiDistrict ? { district: districtStore.apiDistrict } : undefined
    const res = await getAreaConfigList(params)
    list.value = res.list || []
    // 从已有配置中提取网络支撑中心选项
    const centers = [...new Set(list.value.map(i => i.networkCenter).filter(Boolean))].sort()
    networkCenterOptions.value = centers as string[]
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

const loadStaffOptions = async () => {
  const district = districtStore.apiDistrict ?? undefined
  const [d, c, s, n, distinct] = await Promise.all([
    getStaffList({ role: 'DESIGN', pageSize: 200, district }),
    getStaffList({ role: 'CONSTRUCTION', pageSize: 200, district }),
    getStaffList({ role: 'SUPERVISOR', pageSize: 200, district }),
    getStaffList({ role: 'NETWORK_MANAGER', pageSize: 200, district }),
    getStaffDistinct({ district })
  ])
  designStaff.value = d.list
  constructionStaff.value = c.list
  supervisorStaff.value = s.list
  networkManagerStaff.value = n.list
  // 合并单位+网格作为受理区域候选
  const allAreaOptions = [...new Set([...distinct.areas, ...distinct.gridNames])].sort()
  gridNameOptions.value = allAreaOptions
}

const resetForm = () => {
  form.district = districtStore.apiDistrict || '射洪市'
  form.acceptArea = ''
  form.networkCenter = ''
  form.designCandidates = []
  form.constructionCandidates = []
  form.supervisorCandidates = []
  form.networkManagerId = ''
  form.active = true
}

const handleAdd = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row: AreaConfig) => {
  isEdit.value = true
  form.district = row.district || districtStore.apiDistrict || '射洪市'
  form.acceptArea = row.acceptArea
  form.networkCenter = row.networkCenter || ''
  form.designCandidates = (row.designCandidates || []).map(u => u._id)
  form.constructionCandidates = (row.constructionCandidates || []).map(u => u._id)
  form.supervisorCandidates = (row.supervisorCandidates || []).map(u => u._id)
  form.networkManagerId = row.networkManagerId ? row.networkManagerId._id : ''
  form.active = row.active !== false
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    saving.value = true
    try {
      await saveAreaConfig({
        district: form.district,
        acceptArea: form.acceptArea.trim(),
        networkCenter: form.networkCenter,
        designCandidates: form.designCandidates,
        constructionCandidates: form.constructionCandidates,
        supervisorCandidates: form.supervisorCandidates,
        networkManagerId: form.networkManagerId || null,
        active: form.active
      })
      ElMessage.success('保存成功')
      dialogVisible.value = false
      loadList()
    } catch (e) {
      console.error(e)
    } finally {
      saving.value = false
    }
  })
}

const handleDelete = async (row: AreaConfig) => {
  try {
    await ElMessageBox.confirm(`确定删除「${row.acceptArea}」的配置吗？`, '删除确认', { type: 'warning' })
    await deleteAreaConfig(row._id)
    ElMessage.success('已删除')
    loadList()
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  }
}

onMounted(() => {
  loadList()
  loadStaffOptions()
})

// 区县切换时刷新列表
watch(() => districtStore.apiDistrict, () => {
  loadList()
  loadStaffOptions()
})
</script>

<style scoped>
.area-config-view {
  max-width: 1600px;
}

.toolbar-card {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.count-tip {
  font-size: 14px;
  color: #909399;
  margin-left: 16px;
}

.text-placeholder {
  color: #c0c4cc;
  font-size: 13px;
}

:deep(.el-table) { font-size: 15px; }
:deep(.el-table th) { font-size: 15px; font-weight: bold; }
:deep(.el-table td) { padding: 10px 0; }
:deep(.el-dialog) { font-size: 15px; }
:deep(.el-form-item__label) { font-size: 14px; }
</style>
