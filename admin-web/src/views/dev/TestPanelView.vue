<!-- DEV-ONLY: Remove this file and its router entry before production -->
<template>
  <div class="test-panel">
    <el-alert type="warning" :closable="false" style="margin-bottom: 20px;">
      <template #title>
        ⚠️ 开发测试工具 — 仅在开发环境可见，正式上线前需删除此模块
      </template>
    </el-alert>

    <!-- 区域 A：测试账号 -->
    <el-card class="section-card">
      <template #header>
        <div class="card-header">
          <span>测试账号</span>
          <div>
            <el-button size="small" @click="loadAccounts" :loading="accountsLoading">刷新</el-button>
            <el-tag type="info" size="small" style="margin-left: 8px;">统一密码：Test@1234</el-tag>
          </div>
        </div>
      </template>

      <el-alert v-if="!allAccountsExist" type="error" :closable="false" style="margin-bottom: 12px;">
        部分测试账号不存在，请在服务端运行：
        <code>node src/scripts/seed-test-users.js</code>
      </el-alert>

      <el-table :data="accounts" size="small" stripe>
        <el-table-column prop="label" label="角色" width="130" />
        <el-table-column prop="name" label="姓名" width="110">
          <template #default="{ row }">
            <el-tag :type="row.exists ? 'success' : 'danger'" size="small">
              {{ row.exists ? row.name : '未创建' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="130" />
        <el-table-column prop="password" label="密码" width="110" />
        <el-table-column prop="area" label="区域" width="140" show-overflow-tooltip />
        <el-table-column prop="note" label="备注" show-overflow-tooltip />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              @click="copyCredentials(row)"
              :disabled="!row.exists"
            >复制凭据</el-button>
            <el-button
              size="small"
              type="primary"
              @click="getToken(row)"
              :loading="tokenLoading === row.phone"
              :disabled="!row.exists"
            >获取 Token</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 区域 B：场景测试 -->
    <el-card class="section-card">
      <template #header>
        <span>工作流场景测试</span>
      </template>

      <el-row :gutter="16">
        <el-col :span="12" v-for="s in scenarios" :key="s.key">
          <el-card class="scenario-card" shadow="hover">
            <div class="scenario-title">{{ s.title }}</div>
            <div class="scenario-desc">{{ s.desc }}</div>
            <div class="scenario-footer">
              <el-button
                type="primary"
                size="small"
                :loading="runningScenario === s.key"
                @click="runScenario(s.key)"
              >运行</el-button>
              <el-tag
                v-if="scenarioResults[s.key]"
                :type="scenarioResults[s.key].failed === 0 ? 'success' : 'danger'"
                size="small"
              >
                {{ scenarioResults[s.key].passed }} 通过 /
                {{ scenarioResults[s.key].failed }} 失败
              </el-tag>
            </div>

            <!-- 步骤结果 -->
            <div v-if="scenarioResults[s.key]" class="step-list">
              <div
                v-for="(step, i) in scenarioResults[s.key].steps"
                :key="i"
                class="step-item"
                :class="step.status"
              >
                <span class="step-icon">{{ step.status === 'pass' ? '✅' : '❌' }}</span>
                <span class="step-name">{{ step.step }}</span>
                <span class="step-ms">{{ step.ms }}ms</span>
                <div v-if="step.status === 'fail'" class="step-error">{{ step.detail }}</div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- 区域 C：使用说明 -->
    <el-card class="section-card">
      <template #header><span>使用说明</span></template>
      <el-descriptions :column="1" border size="small">
        <el-descriptions-item label="小程序测试">
          在小程序登录页点击「账号密码登录」，使用上表手机号 + 密码 Test@1234 登录对应角色账号
        </el-descriptions-item>
        <el-descriptions-item label="初始化账号">
          <code>cd server && node src/scripts/seed-test-users.js</code>
        </el-descriptions-item>
        <el-descriptions-item label="清理账号">
          <code>cd server && node src/scripts/seed-test-users.js --clean</code>
        </el-descriptions-item>
        <el-descriptions-item label="Postman 调试">
          点击「获取 Token」弹窗中复制 token，在 Postman Header 中设置
          <code>Authorization: Bearer {token}</code>
        </el-descriptions-item>
        <el-descriptions-item label="上线前清理">
          删除 server/src/routes/dev-test.js、server/src/scripts/seed-test-users.js、
          admin-web/src/views/dev/ 目录，移除 app.js 和 router/index.ts 中的相关注册代码
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Token 弹窗 -->
    <el-dialog v-model="tokenDialog.visible" :title="`${tokenDialog.label} Token`" width="560px">
      <el-input
        type="textarea"
        :rows="4"
        v-model="tokenDialog.token"
        readonly
      />
      <div style="margin-top: 12px; font-size: 12px; color: #909399;">
        小程序使用：将此 token 通过「设置 → 开发 → LocalStorage」存入 <code>token</code> 键
      </div>
      <template #footer>
        <el-button type="primary" @click="copyToken">复制 Token</el-button>
        <el-button @click="tokenDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import request from '@/api/request'

interface TestAccount {
  label: string
  phone: string
  password: string
  name: string
  area: string
  gridName: string
  exists: boolean
  active: boolean
  note?: string
}

interface ScenarioStep {
  step: string
  status: 'pass' | 'fail'
  detail: any
  ms: number
}

interface ScenarioResult {
  scenario: string
  steps: ScenarioStep[]
  passed: number
  failed: number
  totalMs: number
}

const accounts = ref<TestAccount[]>([])
const accountsLoading = ref(false)
const tokenLoading = ref<string | null>(null)
const runningScenario = ref<string | null>(null)
const scenarioResults = ref<Record<string, ScenarioResult>>({})

const tokenDialog = ref({ visible: false, token: '', label: '' })

const allAccountsExist = computed(() => accounts.value.every(a => a.exists))

const scenarios = [
  {
    key: 'full',
    title: '完整正向流程',
    desc: '一线创建 → 指派设计 → 设计提交 → 施工开工/完工 → 确认开通'
  },
  {
    key: 'cross_area',
    title: '跨区域审核流程',
    desc: '跨区一线创建 → 网格经理审核通过 → 指派设计/施工 → 开通'
  },
  {
    key: 'reject_resubmit',
    title: '驳回重提流程',
    desc: '创建工单 → 指派设计 → 设计驳回 → 一线重新提交 → 进入设计中'
  },
  {
    key: 'timeout_remind',
    title: '超时催办流程',
    desc: '构造3天前设计中工单 → 管理员发催办 → 验证站内消息写入'
  }
]

async function loadAccounts() {
  accountsLoading.value = true
  try {
    const data = await request.get('/dev/test-accounts')
    accounts.value = data as unknown as TestAccount[]
  } catch (err: any) {
    ElMessage.error('加载测试账号失败：' + err.message)
  } finally {
    accountsLoading.value = false
  }
}

function copyCredentials(row: TestAccount) {
  const text = `手机号：${row.phone}\n密码：${row.password}`
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success('凭据已复制')
  })
}

async function getToken(row: TestAccount) {
  tokenLoading.value = row.phone
  try {
    const data: any = await request.post('/dev/quick-login', { phone: row.phone })
    tokenDialog.value = { visible: true, token: data.token, label: row.label }
  } catch (err: any) {
    ElMessage.error('获取 Token 失败：' + err.message)
  } finally {
    tokenLoading.value = null
  }
}

function copyToken() {
  navigator.clipboard.writeText(tokenDialog.value.token).then(() => {
    ElMessage.success('Token 已复制')
  })
}

async function runScenario(key: string) {
  runningScenario.value = key
  try {
    const data: any = await request.post('/dev/run-scenario', { scenario: key })
    scenarioResults.value[key] = data
    if (data.failed === 0) {
      ElMessage.success(`场景「${key}」全部通过（${data.passed} 步）`)
    } else {
      ElMessage.warning(`场景「${key}」有 ${data.failed} 步失败，请查看详情`)
    }
  } catch (err: any) {
    ElMessage.error('运行场景失败：' + err.message)
  } finally {
    runningScenario.value = null
  }
}

onMounted(() => {
  loadAccounts()
})
</script>

<style scoped>
.test-panel {
  max-width: 1200px;
}

.section-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.scenario-card {
  margin-bottom: 12px;
  min-height: 120px;
}

.scenario-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
}

.scenario-desc {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}

.scenario-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.step-list {
  border-top: 1px solid #ebeef5;
  padding-top: 10px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 3px 0;
  font-size: 12px;
}

.step-item.pass .step-name { color: #67c23a; }
.step-item.fail .step-name { color: #f56c6c; }

.step-icon { flex-shrink: 0; }
.step-name { flex: 1; }
.step-ms { color: #c0c4cc; white-space: nowrap; }
.step-error {
  width: 100%;
  color: #f56c6c;
  font-size: 11px;
  background: #fef0f0;
  padding: 2px 6px;
  border-radius: 3px;
  margin-top: 2px;
}

code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 12px;
}
</style>
