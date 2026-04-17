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
            name="fastgpt-host"
            autocomplete="off"
            placeholder="例如 https://cloud.fastgpt.cn/api"
            style="max-width: 480px;"
            clearable
          />
        </el-form-item>
        <el-form-item label="FastGPT API Key">
          <el-input
            v-model="fastgptForm.apiKey"
            name="fastgpt-api-key"
            autocomplete="new-password"
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
          <el-col :span="12">
            <el-form-item label="跨区审核超时">
              <el-input-number
                v-model="timeoutForm.crossAreaAuditTimeoutDays"
                :min="0.5" :max="30" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="跨区审核预警">
              <el-input-number
                v-model="timeoutForm.crossAreaAuditWarningDays"
                :min="0.5" :max="30" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开通确认超时">
              <el-input-number
                v-model="timeoutForm.confirmationTimeoutDays"
                :min="0.5" :max="30" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开通确认预警">
              <el-input-number
                v-model="timeoutForm.confirmationWarningDays"
                :min="0.5" :max="30" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="总体超时天数">
              <el-input-number
                v-model="timeoutForm.overallTimeoutDays"
                :min="minOverallTimeoutDays" :max="120" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="总体预警天数">
              <el-input-number
                v-model="timeoutForm.overallWarningDays"
                :min="0.5" :max="120" :step="0.5" :precision="1"
                style="width: 140px"
              />
              <span class="unit-label">天</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" style="margin-top: 4px;">
          超时检查每小时执行一次。预警天数须小于对应超时天数；总体超时天数须不小于设计超时天数与施工超时天数之和。
        </el-alert>
      </el-form>
    </el-card>

    <!-- 卡片2：自动督办发送策略 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>自动督办发送策略</span>
          <el-button type="primary" size="small" :loading="savingAutoReminder" @click="saveAutoReminderConfig">
            保存配置
          </el-button>
        </div>
      </template>
      <el-form :model="autoReminderForm" label-width="130px" class="auto-reminder-form" v-loading="loading">
        <el-row :gutter="40">
          <el-col :span="12">
            <el-form-item label="发送开始时间">
              <el-time-picker
                v-model="autoReminderForm.businessWindowStart"
                value-format="HH:mm"
                format="HH:mm"
                placeholder="08:30"
                style="width: 140px"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="发送结束时间">
              <el-time-picker
                v-model="autoReminderForm.businessWindowEnd"
                value-format="HH:mm"
                format="HH:mm"
                placeholder="18:30"
                style="width: 140px"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="检查间隔">
              <el-input-number
                v-model="autoReminderForm.checkIntervalMinutes"
                :min="1" :max="60" :step="1"
                style="width: 140px"
              />
              <span class="unit-label">分钟</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="批次宽限">
              <el-input-number
                v-model="autoReminderForm.batchGraceMinutes"
                :min="0" :max="30" :step="1"
                style="width: 140px"
              />
              <span class="unit-label">分钟</span>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="普通发送批次">
              <el-select
                v-model="autoReminderForm.normalReminderBatches"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="例如 09:00、14:30、17:30"
                style="width: 520px"
              >
                <el-option v-for="opt in batchTimeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="紧急发送批次">
              <el-select
                v-model="autoReminderForm.urgentReminderBatches"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="仅超时事件或特急工单使用"
                style="width: 520px"
              >
                <el-option v-for="opt in batchTimeOptions" :key="opt" :label="opt" :value="opt" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单工单日上限">
              <el-input-number
                v-model="autoReminderForm.maxSendsPerDemandPerDay"
                :min="1" :max="20" :step="1"
                style="width: 140px"
              />
              <span class="unit-label">次/天</span>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="单事件日上限">
              <el-input-number
                v-model="autoReminderForm.maxSendsPerEventPerDay"
                :min="1" :max="20" :step="1"
                style="width: 140px"
              />
              <span class="unit-label">次/天</span>
            </el-form-item>
          </el-col>
        </el-row>
        <el-alert type="info" :closable="false" style="margin-top: 4px;">
          自动督办固定按北京时间执行。普通批次用于预警和常规超时，紧急批次仅用于超时事件或特急工单；系统会按批次和每日上限自动去重。
        </el-alert>
      </el-form>
    </el-card>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { View, Hide } from '@element-plus/icons-vue'
import { getConfigList, updateConfig, type ConfigItem } from '@/api/config'

// ── 特殊配置的 key 常量 ──────────────────────────────────
const KEY_TIMEOUT      = 'TIMEOUT_CONFIG'
const KEY_FASTGPT_HOST = 'FASTGPT_HOST'
const KEY_FASTGPT_KEY  = 'FASTGPT_API_KEY'
const KEY_AUTO_REMINDER = 'AUTO_REMINDER_CONFIG'

// ── 公共状态 ──────────────────────────────────────────────
const loading      = ref(false)
const allConfigs   = ref<ConfigItem[]>([])  // 全量原始数据

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
  constructionWarningDays: 4,
  crossAreaAuditTimeoutDays: 1,
  crossAreaAuditWarningDays: 0.5,
  confirmationTimeoutDays: 1,
  confirmationWarningDays: 0.5,
  overallTimeoutDays: 7,
  overallWarningDays: 6
})

const minOverallTimeoutDays = computed(() =>
  Number(timeoutForm.value.designTimeoutDays || 0) + Number(timeoutForm.value.constructionTimeoutDays || 0)
)

watch(
  () => [timeoutForm.value.designTimeoutDays, timeoutForm.value.constructionTimeoutDays],
  () => {
    if (timeoutForm.value.overallTimeoutDays < minOverallTimeoutDays.value) {
      timeoutForm.value.overallTimeoutDays = minOverallTimeoutDays.value
    }
    if (timeoutForm.value.overallWarningDays >= timeoutForm.value.overallTimeoutDays) {
      timeoutForm.value.overallWarningDays = Math.max(0.5, timeoutForm.value.overallTimeoutDays - 0.5)
    }
  }
)

// ── 卡片2：自动督办发送策略 ───────────────────────────────
const savingAutoReminder = ref(false)
const autoReminderTimezone = ref('Asia/Shanghai')
const autoReminderForm = ref({
  businessWindowStart: '08:30',
  businessWindowEnd: '18:30',
  checkIntervalMinutes: 10,
  normalReminderBatches: ['09:00', '14:30', '17:30'],
  urgentReminderBatches: ['18:20'],
  batchGraceMinutes: 9,
  maxSendsPerDemandPerDay: 2,
  maxSendsPerEventPerDay: 2
})

const batchTimeOptions = [
  '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00',
  '17:30', '18:00', '18:20'
]

const isTimeLabel = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const timeToMinutes = (value: string) => {
  if (!isTimeLabel(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

const normalizeTimeList = (list: string[]) =>
  Array.from(new Set(list.map(item => item.trim()).filter(isTimeLabel))).sort()

// ── 数据加载 ──────────────────────────────────────────────
const loadConfigs = async () => {
  loading.value = true
  try {
    allConfigs.value = await getConfigList()
    syncFastgptForm()
    syncTimeoutForm()
    syncAutoReminderForm()
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
      constructionWarningDays: cfg.value.constructionWarningDays ?? 4,
      crossAreaAuditTimeoutDays: cfg.value.crossAreaAuditTimeoutDays ?? 1,
      crossAreaAuditWarningDays: cfg.value.crossAreaAuditWarningDays ?? 0.5,
      confirmationTimeoutDays: cfg.value.confirmationTimeoutDays ?? 1,
      confirmationWarningDays: cfg.value.confirmationWarningDays ?? 0.5,
      overallTimeoutDays: cfg.value.overallTimeoutDays ?? 7,
      overallWarningDays: cfg.value.overallWarningDays ?? 6
    }
  }
}

const syncAutoReminderForm = () => {
  const cfg = allConfigs.value.find(c => c.key === KEY_AUTO_REMINDER)
  if (cfg && typeof cfg.value === 'object') {
    autoReminderTimezone.value = typeof cfg.value.timezone === 'string' ? cfg.value.timezone : 'Asia/Shanghai'
    autoReminderForm.value = {
      businessWindowStart: cfg.value.businessWindowStart ?? '08:30',
      businessWindowEnd: cfg.value.businessWindowEnd ?? '18:30',
      checkIntervalMinutes: cfg.value.checkIntervalMinutes ?? 10,
      normalReminderBatches: Array.isArray(cfg.value.normalReminderBatches) ? cfg.value.normalReminderBatches : ['09:00', '14:30', '17:30'],
      urgentReminderBatches: Array.isArray(cfg.value.urgentReminderBatches) ? cfg.value.urgentReminderBatches : ['18:20'],
      batchGraceMinutes: cfg.value.batchGraceMinutes ?? 9,
      maxSendsPerDemandPerDay: cfg.value.maxSendsPerDemandPerDay ?? 2,
      maxSendsPerEventPerDay: cfg.value.maxSendsPerEventPerDay ?? 2
    }
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
  const {
    designWarningDays,
    designTimeoutDays,
    constructionWarningDays,
    constructionTimeoutDays,
    crossAreaAuditWarningDays,
    crossAreaAuditTimeoutDays,
    confirmationWarningDays,
    confirmationTimeoutDays,
    overallWarningDays,
    overallTimeoutDays
  } = timeoutForm.value
  if (designWarningDays >= designTimeoutDays) {
    ElMessage.warning('设计预警天数须小于设计超时天数')
    return
  }
  if (constructionWarningDays >= constructionTimeoutDays) {
    ElMessage.warning('施工预警天数须小于施工超时天数')
    return
  }
  if (crossAreaAuditWarningDays >= crossAreaAuditTimeoutDays) {
    ElMessage.warning('跨区审核预警天数须小于跨区审核超时天数')
    return
  }
  if (confirmationWarningDays >= confirmationTimeoutDays) {
    ElMessage.warning('开通确认预警天数须小于开通确认超时天数')
    return
  }
  if (overallWarningDays >= overallTimeoutDays) {
    ElMessage.warning('总体预警天数须小于总体超时天数')
    return
  }
  if (overallTimeoutDays < designTimeoutDays + constructionTimeoutDays) {
    ElMessage.warning('总体超时天数须不小于设计超时天数与施工超时天数之和')
    return
  }
  savingTimeout.value = true
  try {
    await updateConfig(KEY_TIMEOUT, {
      value: { ...timeoutForm.value },
      label: '超时阈值配置',
      description: '设计、施工、跨区审核、开通确认、总体超时与预警天数配置。'
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
const saveAutoReminderConfig = async () => {
  const start = timeToMinutes(autoReminderForm.value.businessWindowStart)
  const end = timeToMinutes(autoReminderForm.value.businessWindowEnd)
  if (start == null || end == null || start >= end) {
    ElMessage.warning('发送时间窗口格式错误，开始时间须早于结束时间')
    return
  }

  const normalBatches = normalizeTimeList(autoReminderForm.value.normalReminderBatches)
  const urgentBatches = normalizeTimeList(autoReminderForm.value.urgentReminderBatches)
  if (!normalBatches.length) {
    ElMessage.warning('请至少配置一个普通发送批次')
    return
  }

  const outOfWindow = [...normalBatches, ...urgentBatches].some((item) => {
    const minutes = timeToMinutes(item)
    return minutes == null || minutes < start || minutes > end
  })
  if (outOfWindow) {
    ElMessage.warning('发送批次必须位于发送时间窗口内')
    return
  }

  savingAutoReminder.value = true
  try {
    await updateConfig(KEY_AUTO_REMINDER, {
      value: {
        timezone: autoReminderTimezone.value || 'Asia/Shanghai',
        ...autoReminderForm.value,
        normalReminderBatches: normalBatches,
        urgentReminderBatches: urgentBatches
      },
      label: '自动督办发送配置',
      description: '自动督办按北京时间检查、固定批次发送、每日限频，避免服务启动时间影响飞书提醒。'
    })
    ElMessage.success('自动督办发送策略保存成功')
    loadConfigs()
  } catch (error) {
    console.error(error)
  } finally {
    savingAutoReminder.value = false
  }
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
