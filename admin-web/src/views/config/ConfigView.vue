<template>
  <div class="config-view">

    <!-- 卡片0：FastGPT 知识问答配置 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>FastGPT 知识问答配置</span>
          <el-button type="primary" size="small" :loading="savingFastgpt" @click="saveFastgptConfig">
            保存配置
          </el-button>
        </div>
      </template>
      <el-form :model="fastgptForm" label-width="130px" v-loading="loading" style="padding: 8px 0;">
        <el-form-item label="FastGPT 服务地址">
          <el-input
            v-model="fastgptForm.host"
            placeholder="例如 https://cloud.fastgpt.cn/api"
            style="max-width: 480px;"
            clearable
          />
        </el-form-item>
        <el-form-item label="FastGPT API Key">
          <el-input
            v-model="fastgptForm.apiKey"
            :type="showApiKey ? 'text' : 'password'"
            placeholder="fastgpt-xxxxxxxxxxxxxxxxxxxxxxxx"
            style="max-width: 480px;"
          >
            <template #suffix>
              <el-icon style="cursor:pointer;" @click="showApiKey = !showApiKey">
                <View v-if="!showApiKey" />
                <Hide v-else />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <el-alert type="info" :closable="false" style="margin-top: 4px; max-width: 640px;">
          小程序「问问」功能通过此配置调用 FastGPT 知识库。API Key 保存后仅在后端存储，不会明文暴露给前端列表。
        </el-alert>
      </el-form>
    </el-card>

    <!-- 卡片1：超时阈值配置 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>超时阈值配置</span>
          <el-button type="primary" size="small" :loading="savingTimeout" @click="saveTimeoutConfig">
            保存配置
          </el-button>
        </div>
      </template>
      <el-form :model="timeoutForm" label-width="110px" class="timeout-form" v-loading="loading">
        <el-row :gutter="40">
          <el-col :span="12">
            <el-form-item label="设计超时天数">
              <el-input-number
                v-model="timeoutForm.designTimeoutDays"
                :min="0.5" :max="30" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设计预警天数">
              <el-input-number
                v-model="timeoutForm.designWarningDays"
                :min="0.5" :max="30" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="施工超时天数">
              <el-input-number
                v-model="timeoutForm.constructionTimeoutDays"
                :min="0.5" :max="60" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="施工预警天数">
              <el-input-number
                v-model="timeoutForm.constructionWarningDays"
                :min="0.5" :max="60" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" style="margin-top: 4px;">
          修改后需重启服务端才能使超时检查任务生效。预警天数须小于对应超时天数。
        </el-alert>
      </el-form>
    </el-card>

    <!-- 卡片2：服务中心 ↔ 网络支撑中心映射 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <div class="card-header-left">
            <span>服务中心 ↔ 网络支撑中心 映射配置</span>
            <el-select
              v-model="currentMappingDistrict"
              size="small"
              style="width: 110px; margin-left: 16px;"
              @change="syncMappingRows"
            >
              <el-option v-for="d in MAPPING_DISTRICTS" :key="d" :label="d" :value="d" />
            </el-select>
          </div>
          <el-button type="primary" size="small" :loading="savingMapping" @click="saveMapping">
            保存修改
          </el-button>
        </div>
      </template>
      <el-table :data="mappingRows" border stripe size="small" v-loading="loading">
        <el-table-column label="服务中心" min-width="200">
          <template #default="{ row }">
            <el-input v-model="row.center" placeholder="服务中心名称" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="网络支撑中心" min-width="200">
          <template #default="{ row }">
            <el-select
              v-model="row.network"
              placeholder="选择或输入"
              filterable
              allow-create
              size="small"
              style="width: 100%"
            >
              <el-option v-for="opt in networkOptions" :key="opt" :label="opt" :value="opt" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" align="center">
          <template #default="{ $index }">
            <el-button type="danger" link size="small" @click="removeRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div style="margin-top: 12px;">
        <el-button type="primary" plain size="small" @click="addRow">+ 新增一行</el-button>
      </div>
    </el-card>

    <!-- 卡片3：其他系统配置（通用） -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>其他系统配置</span>
          <div>
            <el-input
              v-model="searchKey"
              placeholder="搜索配置项"
              clearable
              size="small"
              style="width: 200px; margin-right: 8px;"
              @keyup.enter="filterOtherConfigs"
              @clear="filterOtherConfigs"
            />
            <el-button size="small" @click="filterOtherConfigs">搜索</el-button>
            <el-button type="success" size="small" @click="showAddDialog">新增配置</el-button>
            <el-button type="warning" size="small" @click="showImportDialog">批量导入</el-button>
            <el-button type="info" size="small" @click="handleExport">导出配置</el-button>
          </div>
        </div>
      </template>
      <el-table :data="otherConfigs" v-loading="loading" stripe>
        <el-table-column prop="key" label="配置键" width="220" />
        <el-table-column prop="label" label="名称" width="180" />
        <el-table-column prop="value" label="值">
          <template #default="{ row }">
            <el-popover
              v-if="typeof row.value === 'object'"
              placement="top-start"
              :width="400"
              trigger="hover"
            >
              <template #reference>
                <el-tag type="info" size="small" style="cursor:pointer">JSON 对象（hover 查看）</el-tag>
              </template>
              <pre style="max-height:200px;overflow:auto;font-size:12px;margin:0">{{ JSON.stringify(row.value, null, 2) }}</pre>
            </el-popover>
            <span v-else>{{ row.value }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" show-overflow-tooltip />
        <el-table-column prop="updatedAt" label="更新时间" width="180">
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无其他配置项，可点击「新增配置」添加" />
        </template>
      </el-table>
    </el-card>

    <!-- 编辑/新增弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="配置键">
          <el-input v-model="form.key" :disabled="isEdit" placeholder="唯一标识" />
        </el-form-item>
        <el-form-item label="名称">
          <el-input v-model="form.label" placeholder="配置名称" />
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="form.valueStr" placeholder="配置值（对象请输入JSON）" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="配置说明" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="批量导入配置" width="700px">
      <el-tabs v-model="importTab">
        <el-tab-pane label="JSON 格式" name="json">
          <el-alert type="info" :closable="false" style="margin-bottom: 15px;">
            请输入JSON格式的配置数据数组，每项包含 key、value、label、description 字段
          </el-alert>
          <el-input v-model="importData" type="textarea" :rows="10" placeholder='[{"key": "MY_KEY", "value": "my_value", "label": "名称", "description": "说明"}]' />
        </el-tab-pane>
        <el-tab-pane label="CSV 格式" name="csv">
          <el-alert type="info" :closable="false" style="margin-bottom: 15px;">
            请上传 CSV 文件，格式：key,value,label,description（第一行为表头）
          </el-alert>
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".csv"
            :on-change="handleCsvFileChange"
            drag
          >
            <el-icon><UploadFilled /></el-icon>
            <div>将 CSV 文件拖到此处，或<em>点击上传</em></div>
          </el-upload>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="importDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBatchImport">导入</el-button>
      </template>
    </el-dialog>

    <!-- 导出弹窗 -->
    <el-dialog v-model="exportDialogVisible" title="导出配置" width="400px">
      <el-form label-width="100px">
        <el-form-item label="导出格式">
          <el-radio-group v-model="exportFormat">
            <el-radio label="json">JSON</el-radio>
            <el-radio label="csv">CSV</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="exportDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmExport">确认导出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { UploadFilled, View, Hide } from '@element-plus/icons-vue'
import { getConfigList, updateConfig, deleteConfig, batchImportConfig, type ConfigItem } from '@/api/config'

// ── 特殊配置的 key 常量 ──────────────────────────────────
const KEY_TIMEOUT      = 'TIMEOUT_CONFIG'
const KEY_MAP          = 'CENTER_NETWORK_MAP'
const KEY_FASTGPT_HOST = 'FASTGPT_HOST'
const KEY_FASTGPT_KEY  = 'FASTGPT_API_KEY'

// 区县列表
const MAPPING_DISTRICTS = ['射洪市', '蓬溪县', '大英县', '船山区', '安居区']

// ── 类型 ─────────────────────────────────────────────────
interface MappingRow {
  center: string
  network: string
}

// ── 公共状态 ──────────────────────────────────────────────
const loading      = ref(false)
const allConfigs   = ref<ConfigItem[]>([])  // 全量原始数据
const searchKey    = ref('')

// ── 卡片0：FastGPT 配置 ───────────────────────────────────
const savingFastgpt = ref(false)
const showApiKey    = ref(false)
const fastgptForm   = ref({ host: '', apiKey: '' })

// ── 卡片1：超时阈值 ───────────────────────────────────────
const savingTimeout = ref(false)
const timeoutForm = ref({
  designTimeoutDays:      2,
  constructionTimeoutDays: 5,
  designWarningDays:      1.5,
  constructionWarningDays: 4
})

// ── 卡片2：映射配置 ───────────────────────────────────────
const savingMapping = ref(false)
const mappingRows   = ref<MappingRow[]>([])
const currentMappingDistrict = ref('射洪市')

// 网络支撑中心选项：从现有映射中动态提取 + 去重
const networkOptions = computed(() => {
  const set = new Set(mappingRows.value.map(r => r.network).filter(Boolean))
  return Array.from(set).sort()
})

// ── 卡片3：其他配置 ───────────────────────────────────────
const SPECIAL_KEYS = new Set([KEY_TIMEOUT, KEY_MAP, KEY_FASTGPT_HOST, KEY_FASTGPT_KEY])

const otherConfigs = computed(() => {
  const base = allConfigs.value.filter(c => !SPECIAL_KEYS.has(c.key))
  if (!searchKey.value) return base
  const kw = searchKey.value.toLowerCase()
  return base.filter(c =>
    c.key.toLowerCase().includes(kw) ||
    (c.label?.toLowerCase().includes(kw) ?? false)
  )
})

// ── 弹窗 ──────────────────────────────────────────────────
const dialogVisible      = ref(false)
const importDialogVisible = ref(false)
const exportDialogVisible = ref(false)
const isEdit    = ref(false)
const dialogTitle = computed(() => isEdit.value ? '编辑配置' : '新增配置')

const form = ref({ key: '', label: '', valueStr: '', description: '' })
const importData    = ref('')
const importTab     = ref('json')
const csvFileContent = ref('')
const exportFormat  = ref('json')

// ── 工具函数 ──────────────────────────────────────────────
const formatDate = (date: string) => date ? new Date(date).toLocaleString('zh-CN') : '-'

// ── 数据加载 ──────────────────────────────────────────────
const loadConfigs = async () => {
  loading.value = true
  try {
    allConfigs.value = await getConfigList()
    syncFastgptForm()
    syncTimeoutForm()
    syncMappingRows()
  } catch (error: any) {
    console.error('加载系统配置失败', error)
    allConfigs.value = []
  } finally {
    loading.value = false
  }
}

const syncFastgptForm = () => {
  const hostCfg = allConfigs.value.find(c => c.key === KEY_FASTGPT_HOST)
  const keyCfg  = allConfigs.value.find(c => c.key === KEY_FASTGPT_KEY)
  fastgptForm.value = {
    host:   typeof hostCfg?.value === 'string' ? hostCfg.value : '',
    apiKey: typeof keyCfg?.value  === 'string' ? keyCfg.value  : ''
  }
}

const syncTimeoutForm = () => {
  const cfg = allConfigs.value.find(c => c.key === KEY_TIMEOUT)
  if (cfg && typeof cfg.value === 'object') {
    timeoutForm.value = {
      designTimeoutDays:       cfg.value.designTimeoutDays       ?? 2,
      constructionTimeoutDays: cfg.value.constructionTimeoutDays ?? 5,
      designWarningDays:       cfg.value.designWarningDays       ?? 1.5,
      constructionWarningDays: cfg.value.constructionWarningDays ?? 4
    }
  }
}

const syncMappingRows = () => {
  const cfg = allConfigs.value.find(c => c.key === KEY_MAP)
  if (cfg && typeof cfg.value === 'object') {
    const nestedValue = cfg.value as Record<string, any>
    // 支持嵌套格式 { '射洪市': { center: network } } 和旧平铺格式
    const DISTRICT_KEYS = new Set(['射洪市', '蓬溪县', '大英县', '船山区', '安居区'])
    const topKeys = Object.keys(nestedValue)
    const isNested = topKeys.length > 0 && topKeys.some(k => DISTRICT_KEYS.has(k))

    if (isNested) {
      const districtMap = nestedValue[currentMappingDistrict.value] as Record<string, string> || {}
      mappingRows.value = Object.entries(districtMap).map(([center, network]) => ({ center, network }))
    } else {
      // 旧平铺格式：全部放入射洪市
      if (currentMappingDistrict.value === '射洪市') {
        mappingRows.value = Object.entries(nestedValue as Record<string, string>).map(
          ([center, network]) => ({ center, network })
        )
      } else {
        mappingRows.value = []
      }
    }
  } else {
    mappingRows.value = []
  }
}

// ── 卡片0 操作 ────────────────────────────────────────────
const saveFastgptConfig = async () => {
  if (!fastgptForm.value.host.trim()) {
    ElMessage.warning('请填写 FastGPT 服务地址')
    return
  }
  if (!fastgptForm.value.apiKey.trim()) {
    ElMessage.warning('请填写 FastGPT API Key')
    return
  }
  savingFastgpt.value = true
  try {
    await Promise.all([
      updateConfig(KEY_FASTGPT_HOST, {
        value: fastgptForm.value.host.trim(),
        label: 'FastGPT 服务地址',
        description: 'FastGPT API 根地址，用于「问问」知识问答功能'
      }),
      updateConfig(KEY_FASTGPT_KEY, {
        value: fastgptForm.value.apiKey.trim(),
        label: 'FastGPT API Key',
        description: 'FastGPT 知识库应用的 API 访问密钥'
      })
    ])
    ElMessage.success('FastGPT 配置保存成功')
    loadConfigs()
  } catch (error) {
    console.error(error)
  } finally {
    savingFastgpt.value = false
  }
}

// ── 卡片1 操作 ────────────────────────────────────────────
const saveTimeoutConfig = async () => {
  const { designWarningDays, designTimeoutDays, constructionWarningDays, constructionTimeoutDays } = timeoutForm.value
  if (designWarningDays >= designTimeoutDays) {
    ElMessage.warning('设计预警天数须小于设计超时天数')
    return
  }
  if (constructionWarningDays >= constructionTimeoutDays) {
    ElMessage.warning('施工预警天数须小于施工超时天数')
    return
  }
  savingTimeout.value = true
  try {
    await updateConfig(KEY_TIMEOUT, {
      value: { ...timeoutForm.value },
      label: '超时阈值配置',
      description: '设计超时天数、施工超时天数、预警天数。修改后需重启服务生效。'
    })
    ElMessage.success('超时阈值保存成功')
    loadConfigs()
  } catch (error) {
    console.error(error)
  } finally {
    savingTimeout.value = false
  }
}

// ── 卡片2 操作 ────────────────────────────────────────────
const addRow = () => {
  mappingRows.value.push({ center: '', network: '' })
}

const removeRow = (index: number) => {
  mappingRows.value.splice(index, 1)
}

const saveMapping = async () => {
  const invalid = mappingRows.value.some(r => !r.center.trim())
  if (invalid) {
    ElMessage.warning('存在空的服务中心名称，请填写后再保存')
    return
  }
  // 构建当前区县的映射对象
  const districtMap: Record<string, string> = {}
  mappingRows.value.forEach(r => {
    if (r.center.trim()) districtMap[r.center.trim()] = r.network
  })

  // 读取当前完整配置，只更新当前区县的分片
  const cfg = allConfigs.value.find(c => c.key === KEY_MAP)
  const fullValue: Record<string, any> = cfg && typeof cfg.value === 'object' ? { ...cfg.value as object } : {}
  fullValue[currentMappingDistrict.value] = districtMap

  savingMapping.value = true
  try {
    await updateConfig(KEY_MAP, {
      value: fullValue,
      label: '服务中心网络支撑映射',
      description: '各区县服务中心与网络支撑中心的对应关系，用于需求创建时自动带出网络支撑中心'
    })
    ElMessage.success(`${currentMappingDistrict.value} 映射配置保存成功`)
    loadConfigs()
  } catch (error) {
    console.error(error)
  } finally {
    savingMapping.value = false
  }
}

// ── 卡片3 操作 ────────────────────────────────────────────
const filterOtherConfigs = () => {
  // computed 属性已响应 searchKey，无需手动触发
}

const showAddDialog = () => {
  isEdit.value = false
  form.value = { key: '', label: '', valueStr: '', description: '' }
  dialogVisible.value = true
}

const handleEdit = (row: ConfigItem) => {
  isEdit.value = true
  form.value = {
    key: row.key,
    label: row.label || '',
    valueStr: typeof row.value === 'object' ? JSON.stringify(row.value, null, 2) : String(row.value),
    description: row.description || ''
  }
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.value.key) {
    ElMessage.warning('请输入配置键')
    return
  }
  try {
    let value: any = form.value.valueStr
    try { value = JSON.parse(form.value.valueStr) } catch { /* 非JSON，保持字符串 */ }
    await updateConfig(form.value.key, {
      value,
      label: form.value.label,
      description: form.value.description
    })
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadConfigs()
  } catch (error) {
    console.error(error)
  }
}

const handleDelete = async (row: ConfigItem) => {
  try {
    await ElMessageBox.confirm(`确定删除配置 "${row.key}" 吗？`, '提示', { type: 'warning' })
    await deleteConfig(row.key)
    ElMessage.success('删除成功')
    loadConfigs()
  } catch (error) {
    if (error !== 'cancel') console.error(error)
  }
}

const showImportDialog = () => {
  importData.value = ''
  csvFileContent.value = ''
  importTab.value = 'json'
  importDialogVisible.value = true
}

const handleCsvFileChange = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => { csvFileContent.value = e.target?.result as string || '' }
  reader.readAsText(file.raw)
}

const handleBatchImport = async () => {
  try {
    let items: any[] = []
    if (importTab.value === 'json') {
      items = JSON.parse(importData.value)
    } else {
      if (!csvFileContent.value) { ElMessage.error('请先上传 CSV 文件'); return }
      items = parseCSV(csvFileContent.value)
    }
    if (!Array.isArray(items)) { ElMessage.error('数据格式错误，请输入数组格式'); return }
    const result = await batchImportConfig(items)
    ElMessage.success(`导入成功：${(result as any).success} 项`)
    if ((result as any).errors?.length) {
      ElMessage.warning(`部分失败：${(result as any).errors.join(', ')}`)
    }
    importDialogVisible.value = false
    loadConfigs()
  } catch (error) {
    ElMessage.error('格式错误或导入失败')
    console.error(error)
  }
}

const parseCSV = (content: string): any[] => {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const item: any = {}
    headers.forEach((header, i) => {
      if (header === 'value' && values[i]?.startsWith('{')) {
        try { item[header] = JSON.parse(values[i].replace(/'/g, '"')) } catch { item[header] = values[i] }
      } else {
        item[header] = values[i] || ''
      }
    })
    return item.key ? item : null
  }).filter(Boolean)
}

const handleExport = () => {
  exportFormat.value = 'json'
  exportDialogVisible.value = true
}

const confirmExport = () => {
  const data = allConfigs.value
  let content: string
  let filename: string
  if (exportFormat.value === 'json') {
    content = JSON.stringify(data, null, 2)
    filename = 'configs.json'
    downloadFile(content, filename, 'application/json')
  } else {
    const lines = ['\ufeffkey,label,value,description']
    data.forEach(item => {
      lines.push([
        `"${item.key || ''}"`,
        `"${item.label || ''}"`,
        `"${typeof item.value === 'object' ? JSON.stringify(item.value).replace(/"/g, "'") : item.value || ''}"`,
        `"${item.description || ''}"`
      ].join(','))
    })
    content = lines.join('\n')
    filename = 'configs.csv'
    downloadFile(content, filename, 'text/csv')
  }
  exportDialogVisible.value = false
  ElMessage.success('导出成功')
}

const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadConfigs()
})
</script>

<style scoped>
.config-view {
  max-width: 1200px;
}

.config-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-left {
  display: flex;
  align-items: center;
}

.timeout-form {
  padding: 8px 0;
}

.unit-label {
  margin-left: 8px;
  color: #606266;
  font-size: 13px;
}
</style>
