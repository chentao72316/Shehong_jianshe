<template>
  <div class="area-config-view">
    <el-card class="toolbar-card">
      <el-button v-if="canManageAreaConfig" type="primary" @click="handleAdd">
        <el-icon><Plus /></el-icon>新增区域配置
      </el-button>
      <el-button type="success" @click="handleExport">导出</el-button>
      <el-button v-if="canManageAreaConfig" type="warning" @click="handleImport">导入</el-button>
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

    <el-dialog v-model="importDialogVisible" title="导入区域配置" width="620px">
      <div class="import-tips">
        <p><strong>导入说明：</strong></p>
        <ul>
          <li>按“区县 + 受理区域”匹配：已存在则更新，不存在则新增。</li>
          <li>不会删除导入表中没有出现的旧区域配置。</li>
          <li>候选人建议填写“姓名(手机号)”；系统会优先按手机号匹配。</li>
          <li>多个候选人用 / 分隔。</li>
        </ul>
      </div>
      <el-upload
        :auto-upload="false"
        :limit="1"
        accept=".csv"
        :on-change="handleFileChange"
        :file-list="fileList"
      >
        <el-button type="primary">选择 CSV 文件</el-button>
        <template #tip>
          <div class="el-upload__tip">请先下载导入模板，按模板字段维护后再导入</div>
        </template>
      </el-upload>
      <div style="margin-top: 15px;">
        <el-button type="success" @click="downloadTemplate">下载导入模板</el-button>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button v-if="canManageAreaConfig" type="primary" :loading="importing" @click="handleImportConfirm">确定导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getAreaConfigList, saveAreaConfig, deleteAreaConfig, getStaffList, getStaffDistinct, exportAreaConfig, importAreaConfig } from '@/api'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { AreaConfig, StaffMember } from '@/types'
import { useDistrictStore } from '@/stores/district'
import { useUserStore } from '@/stores/user'

const districtStore = useDistrictStore()
const userStore = useUserStore()
const canManageAreaConfig = userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER'])

const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const importDialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const fileList = ref<UploadFile[]>([])
const importData = ref<any[]>([])

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
    getStaffList({ role: 'DESIGN', pageSize: 200, district, includeServiceDistrict: true }),
    getStaffList({ role: 'CONSTRUCTION', pageSize: 200, district, includeServiceDistrict: true }),
    getStaffList({ role: 'SUPERVISOR', pageSize: 200, district, includeServiceDistrict: true }),
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

const handleExport = async () => {
  try {
    await exportAreaConfig({ district: districtStore.apiDistrict ?? undefined })
    ElMessage.success('导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('导出失败')
  }
}

const handleImport = () => {
  importData.value = []
  fileList.value = []
  importDialogVisible.value = true
}

const handleFileChange = (file: UploadFile) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const buffer = e.target?.result as ArrayBuffer
      let content = new TextDecoder('utf-8').decode(buffer)
      let lines = content.split('\n').filter(line => line.trim())
      const firstLine = lines[0] || ''
      const hasUTF8Header = firstLine.includes('区县') && firstLine.includes('受理区域')

      if (!hasUTF8Header && lines.length > 0) {
        content = new TextDecoder('gbk').decode(buffer)
        lines = content.split('\n').filter(line => line.trim())
      }

      if (lines.length < 2) {
        ElMessage.error('CSV 文件内容为空或格式错误')
        return
      }

      const headers = parseCSVLine(lines[0])
      const data: any[] = []
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i])
        if (values.length === headers.length) {
          const row: any = {}
          headers.forEach((header, index) => {
            row[header] = values[index]
          })
          data.push(row)
        }
      }

      importData.value = data
      ElMessage.success(`已解析 ${data.length} 条数据`)
    } catch (e) {
      ElMessage.error('解析 CSV 文件失败')
      console.error(e)
    }
  }
  reader.readAsArrayBuffer(file.raw as any)
}

const parseCSVLine = (line: string): string[] => {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

const handleImportConfirm = async () => {
  if (importData.value.length === 0) {
    ElMessage.warning('请先选择 CSV 文件')
    return
  }

  importing.value = true
  try {
    const result = await importAreaConfig(importData.value)
    ElMessage.success(result.message)
    if (result.details.errors.length > 0) console.error('区域配置导入错误:', result.details.errors)
    importDialogVisible.value = false
    loadList()
  } catch (e) {
    console.error(e)
  } finally {
    importing.value = false
  }
}

const downloadTemplate = () => {
  const template = `区县,受理区域,网络支撑中心,设计候选人,施工候选人,监理候选人,确认经理,状态
射洪市,太和东服务中心,城区网络支撑中心,张三(13800138000)/李四(13800138001),王五(13800138002),赵六(13800138003),钱七(13800138004),启用`

  const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `区域配置导入模板_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
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

.import-tips {
  background: #f5f7fa;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  font-size: 14px;
}

.import-tips ul {
  margin: 5px 0 5px 20px;
  padding-left: 0;
}

.import-tips li {
  margin: 3px 0;
}

:deep(.el-table) { font-size: 15px; }
:deep(.el-table th) { font-size: 15px; font-weight: bold; }
:deep(.el-table td) { padding: 10px 0; }
:deep(.el-dialog) { font-size: 15px; }
:deep(.el-form-item__label) { font-size: 14px; }
</style>
