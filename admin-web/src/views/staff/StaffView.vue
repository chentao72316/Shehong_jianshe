<template>
  <div class="staff-view">
    <!-- 搜索栏 -->
    <el-card class="search-bar">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-input v-model="searchKeyword" placeholder="搜索姓名/手机号" clearable @clear="loadStaff" size="default" />
        </el-col>
        <el-col :span="4">
          <el-select v-model="searchRole" placeholder="选择角色" clearable @change="loadStaff" size="default">
            <el-option label="一线人员" value="FRONTLINE" />
            <el-option label="区县管理员" value="DISTRICT_MANAGER" />
            <el-option label="部门经理" value="DEPT_MANAGER" />
            <el-option label="四级经理" value="LEVEL4_MANAGER" />
            <el-option label="设计" value="DESIGN" />
            <el-option label="施工" value="CONSTRUCTION" />
            <el-option label="监理" value="SUPERVISOR" />
            <el-option label="管理员" value="ADMIN" />
            <el-option label="网格经理" value="GRID_MANAGER" />
            <el-option label="网络支撑经理" value="NETWORK_MANAGER" />
          </el-select>
        </el-col>
        <el-col :span="10">
          <el-button v-if="canManageStaff" type="primary" @click="handleAdd" size="default">新增人员</el-button>
          <el-button type="success" @click="handleExport" size="default">导出</el-button>
          <el-button v-if="canImportStaff" type="warning" @click="handleImport" size="default">导入</el-button>
        </el-col>
      </el-row>
    </el-card>

    <!-- 人员列表 -->
    <el-card>
      <el-table :data="staffList" v-loading="loading" stripe size="large">
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="phone" label="手机号" width="150" />
        <el-table-column prop="wxAccount" label="微信号" width="150" />
        <el-table-column prop="feishuId" label="飞书账号" width="150" />
        <el-table-column prop="roles" label="角色" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="role in row.roles" :key="role" size="small" type="info" style="margin-right: 4px;">
              {{ getRoleName(role) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="area" label="单位" width="120" />
        <el-table-column prop="gridName" label="部门/网格" width="160" />
        <el-table-column prop="employeeId" label="工号" width="120" />
        <el-table-column prop="staffType" label="人员属性" width="100">
          <template #default="{ row }">
            {{ getStaffTypeName(row.staffType) }}
          </template>
        </el-table-column>
        <el-table-column prop="active" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'danger'" size="small">
              {{ row.active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="passwordChanged" label="密码" width="100">
          <template #default="{ row }">
            <el-tag :type="row.passwordChanged ? 'success' : 'warning'" size="small">
              {{ row.passwordChanged ? '已设置' : '未设置' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="270" fixed="right">
          <template #default="{ row }">
            <div style="white-space: nowrap;">
              <el-button v-if="canManageStaff" type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
              <el-button v-if="canManageStaff" type="warning" link size="small" @click="handleResetPassword(row)">重置密码</el-button>
              <el-button v-if="canManageStaff" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
              <el-button
                v-if="canManageStaff"
                :type="row.active ? 'warning' : 'success'"
                link
                size="small"
                @click="handleToggle(row)"
              >
                {{ row.active ? '禁用' : '启用' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadStaff"
        @size-change="loadStaff"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑人员' : '新增人员'" width="700px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" size="large">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="姓名" prop="name">
              <el-input v-model="form.name" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入手机号" maxlength="11" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="微信号">
              <el-input v-model="form.wxAccount" placeholder="请输入微信号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="飞书账号">
              <el-input v-model="form.feishuId" placeholder="请输入飞书账号" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="区县">
              <el-select v-model="form.district" :disabled="!userStore.isAdmin()" style="width: 100%">
                <el-option v-for="d in ['射洪市', '蓬溪县', '大英县', '船山区', '安居区']" :key="d" :label="d" :value="d" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="单位">
              <el-select
                v-model="form.area"
                filterable
                allow-create
                default-first-option
                clearable
                placeholder="请选择或输入单位名称"
                style="width: 100%"
              >
                <el-option v-for="name in areaOptions" :key="name" :label="name" :value="name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="部门/网格">
              <el-select
                v-model="form.gridName"
                filterable
                allow-create
                default-first-option
                clearable
                placeholder="请选择或输入部门/网格名称"
                style="width: 100%"
              >
                <el-option v-for="name in gridNameOptions" :key="name" :label="name" :value="name" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="工号">
              <el-input v-model="form.employeeId" placeholder="请输入工号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="人员属性">
              <el-select v-model="form.staffType" placeholder="请选择人员属性" clearable style="width: 100%">
                <el-option label="自有" value="自有" />
                <el-option label="三方" value="三方" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="角色" prop="roles">
          <el-checkbox-group v-model="form.roles">
            <el-checkbox label="FRONTLINE">一线人员</el-checkbox>
            <el-checkbox label="DISTRICT_MANAGER">区县管理员</el-checkbox>
            <el-checkbox label="DEPT_MANAGER">部门经理</el-checkbox>
            <el-checkbox label="LEVEL4_MANAGER">四级经理</el-checkbox>
            <el-checkbox label="DESIGN">设计</el-checkbox>
            <el-checkbox label="CONSTRUCTION">施工</el-checkbox>
            <el-checkbox label="SUPERVISOR">监理</el-checkbox>
            <el-checkbox v-if="userStore.isAdmin()" label="ADMIN">管理员</el-checkbox>
            <el-checkbox label="GRID_MANAGER">网格经理</el-checkbox>
            <el-checkbox label="NETWORK_MANAGER">网络支撑经理</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button v-if="canManageStaff" type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="450px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="90px">
        <el-form-item label="姓名">
          <span>{{ passwordForm.name }}</span>
        </el-form-item>
        <el-form-item label="手机号">
          <span>{{ passwordForm.phone }}</span>
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="请输入新密码（至少8位）"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button v-if="canManageStaff" type="primary" :loading="passwordLoading" @click="confirmResetPassword">确认重置</el-button>
      </template>
    </el-dialog>

    <!-- 导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="导入人员配置" width="600px">
      <div class="import-tips">
        <p><strong>导入说明：</strong></p>
        <ul>
          <li>以姓名为索引进行匹配</li>
          <li>若原系统已有相同姓名：
            <ul>
              <li>原字段为空，现字段不为空 → 以导入数据为准修改</li>
              <li>原字段不为空，现字段为空 → 保留原字段</li>
            </ul>
          </li>
          <li>若原系统没有该姓名 → 新增该人员</li>
        </ul>
        <p style="margin-top: 10px;"><strong>支持角色：</strong>一线人员、区县管理员、部门经理、四级经理、网格经理、网络支撑经理、设计、施工、监理、管理员</p>
        <p style="margin-top: 5px;"><strong>人员属性：</strong>自有、三方</p>
      </div>
      <el-upload
        class="upload-demo"
        :auto-upload="false"
        :limit="1"
        accept=".csv"
        :on-change="handleFileChange"
        :file-list="fileList"
      >
        <el-button type="primary" size="default">选择 CSV 文件</el-button>
        <template #tip>
          <div class="el-upload__tip">支持 CSV 格式文件，请先下载导入模版</div>
        </template>
      </el-upload>
      <div style="margin-top: 15px;">
        <el-button type="success" size="default" @click="downloadTemplate">下载导入模版</el-button>
      </div>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button v-if="canImportStaff" type="primary" :loading="importing" @click="handleImportConfirm">确定导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { getStaffList, saveStaff, toggleStaff, deleteStaff, importStaff, exportStaff, resetPassword, getStaffDistinct } from '@/api/admin'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules, type UploadFile } from 'element-plus'
import type { StaffMember } from '@/types'
import { useDistrictStore } from '@/stores/district'
import { useUserStore } from '@/stores/user'

const districtStore = useDistrictStore()
const userStore = useUserStore()
const canManageStaff = userStore.hasAnyRole(['ADMIN', 'DISTRICT_MANAGER'])
const canImportStaff = userStore.isAdmin()

const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const dialogVisible = ref(false)
const importDialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()
const fileList = ref<UploadFile[]>([])
const importData = ref<any[]>([])

// 密码重置
const passwordDialogVisible = ref(false)
const passwordLoading = ref(false)
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  userId: '',
  name: '',
  phone: '',
  newPassword: '',
  confirmPassword: ''
})
const passwordRules: FormRules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '密码长度至少8位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const searchRole = ref('')

const staffList = ref<StaffMember[]>([])

// 单位/网格下拉选项（从已登记数据中取）
const areaOptions = ref<string[]>([])
const gridNameOptions = ref<string[]>([])

const form = reactive({
  userId: '',
  name: '',
  phone: '',
  roles: [] as string[],
  district: '射洪市',
  area: '',
  gridName: '',
  feishuId: '',
  wxAccount: '',
  employeeId: '',
  staffType: ''
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  roles: [{ required: true, message: '请至少选择一个角色', trigger: 'change' }]
}

const getRoleName = (role: string) => {
  const map: Record<string, string> = {
    FRONTLINE: '一线人员',
    DISTRICT_MANAGER: '区县管理员',
    DEPT_MANAGER: '部门经理',
    LEVEL4_MANAGER: '四级经理',
    DESIGN: '设计',
    CONSTRUCTION: '施工',
    SUPERVISOR: '监理',
    ADMIN: '管理员',
    GRID_MANAGER: '网格经理',
    NETWORK_MANAGER: '网络支撑经理'
  }
  return map[role] || role
}

const getStaffTypeName = (staffType?: string) => {
  if (!staffType) return '-'
  const map: Record<string, string> = {
    '自有': '自有',
    '三方': '三方'
  }
  return map[staffType] || staffType
}

const loadStaff = async () => {
  loading.value = true
  try {
    const data = await getStaffList({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value,
      role: searchRole.value,
      district: districtStore.apiDistrict ?? undefined
    })
    staffList.value = data.list
    total.value = data.total
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  form.userId = ''
  form.name = ''
  form.phone = ''
  form.roles = []
  form.district = districtStore.apiDistrict || '射洪市'
  form.area = ''
  form.gridName = ''
  form.feishuId = ''
  form.wxAccount = ''
  form.employeeId = ''
  form.staffType = ''
}

const handleAdd = () => {
  isEdit.value = false
  resetForm()
  dialogVisible.value = true
}

const handleEdit = (row: StaffMember) => {
  isEdit.value = true
  form.userId = row.id
  form.name = row.name
  form.phone = row.phone
  form.roles = [...row.roles]
  form.district = row.district || '射洪市'
  form.area = row.area || ''
  form.gridName = row.gridName || ''
  form.feishuId = row.feishuId || ''
  form.wxAccount = row.wxAccount || ''
  form.employeeId = row.employeeId || ''
  form.staffType = row.staffType || ''
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return

    saving.value = true
    try {
      await saveStaff(form as any)
      ElMessage.success('保存成功')
      dialogVisible.value = false
      loadStaff()
    } catch (error) {
      console.error(error)
    } finally {
      saving.value = false
    }
  })
}

const handleToggle = async (row: StaffMember) => {
  const action = row.active ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定${action} ${row.name} 的账号？`, `${action}确认`)
    await toggleStaff(row.id, !row.active)
    ElMessage.success(`${action}成功`)
    loadStaff()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleDelete = async (row: StaffMember) => {
  try {
    await ElMessageBox.confirm(`确定删除 ${row.name} 吗？此操作不可恢复！`, '删除确认', {
      type: 'warning'
    })
    await deleteStaff(row.id)
    ElMessage.success('删除成功')
    loadStaff()
  } catch (error) {
    if (error !== 'cancel') {
      console.error(error)
    }
  }
}

const handleResetPassword = (row: StaffMember) => {
  passwordForm.userId = row.id
  passwordForm.name = row.name
  passwordForm.phone = row.phone
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
  passwordDialogVisible.value = true
}

const confirmResetPassword = async () => {
  if (!passwordFormRef.value) return
  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return
    passwordLoading.value = true
    try {
      await resetPassword(passwordForm.userId, passwordForm.newPassword)
      ElMessage.success(`已为 ${passwordForm.name} 重置密码`)
      passwordDialogVisible.value = false
      loadStaff()
    } catch (error) {
      console.error(error)
    } finally {
      passwordLoading.value = false
    }
  })
}

const handleExport = async () => {
  try {
    await exportStaff({ district: districtStore.apiDistrict ?? undefined })
    ElMessage.success('导出成功')
  } catch (error) {
    console.error(error)
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

      // 先尝试 UTF-8 解码
      let content = new TextDecoder('utf-8').decode(buffer)
      let lines = content.split('\n').filter(line => line.trim())

      // 检查 UTF-8 解码是否乱码（通过检查表头是否包含预期字段）
      const firstLine = lines[0] || ''
      const hasUTF8Header = firstLine.includes('姓名') && firstLine.includes('手机号')

      // 如果 UTF-8 解码后表头不对，尝试 GBK 解码
      if (!hasUTF8Header && lines.length > 0) {
        content = new TextDecoder('gbk').decode(buffer)
        lines = content.split('\n').filter(line => line.trim())
      }

      if (lines.length < 2) {
        ElMessage.error('CSV 文件内容为空或格式错误')
        return
      }

      // 解析表头
      const headers = parseCSVLine(lines[0])

      // 解析数据行
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
    } catch (error) {
      ElMessage.error('解析 CSV 文件失败')
      console.error(error)
    }
  }
  reader.readAsArrayBuffer(file.raw as any)
}

// 简单的 CSV 解析（处理引号和逗号）
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
    const result = await importStaff(importData.value)
    ElMessage.success(result.message)
    if (result.details.errors.length > 0) {
      console.error('导入错误:', result.details.errors)
    }
    importDialogVisible.value = false
    loadStaff()
  } catch (error) {
    console.error(error)
  } finally {
    importing.value = false
  }
}

const loadDistinctOptions = async () => {
  try {
    const { areas, gridNames } = await getStaffDistinct({ district: districtStore.apiDistrict ?? undefined })
    areaOptions.value = areas
    gridNameOptions.value = gridNames
  } catch (e) {
    console.error(e)
  }
}

const downloadTemplate = () => {
  const template = `姓名,手机号,微信号,飞书账号,单位,部门/网格,工号,人员属性,角色,状态
张三,13800138000,wx123456,fs123456,射洪,太和东服务中心,EMP001,自有,一线人员,启用
李四,13800138001,wx234567,fs234567,射洪,太和西服务中心,EMP002,三方,施工,启用
王五,13800138002,wx345678,fs345678,船山,城区网络支撑中心,EMP003,自有,网格经理,启用
赵六,13800138003,wx456789,fs456789,蓬溪,金华网格,EMP004,自有,区县管理员,启用`

  const blob = new Blob(['\ufeff' + template], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `人员配置导入模版_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadStaff()
  loadDistinctOptions()
})

// 区县切换时刷新列表
watch(() => districtStore.apiDistrict, () => {
  currentPage.value = 1
  loadStaff()
  loadDistinctOptions()
})
</script>

<style scoped>
.staff-view {
  max-width: 1800px;
}

.search-bar {
  margin-bottom: 20px;
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

.import-tips ul ul {
  margin-left: 15px;
}

/* 增大字体字号 */
:deep(.el-table) {
  font-size: 18px;
}

:deep(.el-table th) {
  font-size: 18px;
  font-weight: bold;
}

:deep(.el-table td) {
  font-size: 17px;
  padding: 14px 0;
}

:deep(.el-dialog) {
  font-size: 18px;
}

:deep(.el-form-item__label) {
  font-size: 17px;
}

:deep(.el-input__inner) {
  font-size: 16px;
}

:deep(.el-button) {
  font-size: 16px;
}

:deep(.el-tag) {
  font-size: 15px;
}

:deep(.el-pagination) {
  font-size: 16px;
}
</style>
