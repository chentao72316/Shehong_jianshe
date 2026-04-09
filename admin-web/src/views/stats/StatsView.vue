<template>
  <div class="stats-view">
    <!-- 时间筛选 + 导出 -->
    <el-card class="filter-bar">
      <div class="filter-row">
        <el-radio-group v-model="timeRange" @change="loadStats">
          <el-radio-button label="week">本周</el-radio-button>
          <el-radio-button label="month">本月</el-radio-button>
          <el-radio-button label="quarter">本季</el-radio-button>
          <el-radio-button label="year">本年</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Download" @click="exportStats">导出统计</el-button>
      </div>
    </el-card>

    <!-- 汇总卡片 -->
    <el-row :gutter="20" class="summary-row">
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-num">{{ totalCount }}</div>
          <div class="summary-label">工单总数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-num text-success">{{ completedCount }}</div>
          <div class="summary-label">已完成</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-num text-primary">{{ inProgressCount }}</div>
          <div class="summary-label">进行中</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="summary-card">
          <div class="summary-num text-danger">{{ timeoutCount }}</div>
          <div class="summary-label">超时数</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20" class="chart-row">
      <!-- 区域完成率柱状图 -->
      <el-col :span="14">
        <el-card>
          <template #header>
            <span>区域完成率对比</span>
          </template>
          <div ref="areaChartRef" class="chart-container"></div>
        </el-card>
      </el-col>

      <!-- 工单状态分布饼图 -->
      <el-col :span="10">
        <el-card>
          <template #header>
            <span>工单状态分布</span>
          </template>
          <div ref="statusChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 数据表格 -->
    <el-row :gutter="20" class="table-row">
      <!-- 区域统计 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>区域统计</span>
          </template>
          <el-table :data="areaStats" stripe v-loading="loading">
            <el-table-column prop="area" label="区域" />
            <el-table-column prop="total" label="总需求" width="80" />
            <el-table-column prop="completed" label="已完成" width="80" />
            <el-table-column prop="existingResourceCompleted" label="存量开通" width="90" />
            <el-table-column prop="constructionBuildCompleted" label="施工开通" width="90" />
            <el-table-column prop="inProgress" label="进行中" width="80" />
            <el-table-column prop="timeout" label="超时数" width="80">
              <template #default="{ row }">
                <span :class="{ 'text-danger': row.timeout > 0 }">{{ row.timeout }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="completionRate" label="完成率" width="80">
              <template #default="{ row }">
                {{ (row.completionRate * 100).toFixed(1) }}%
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 网格统计 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>网格统计</span>
          </template>
          <el-table :data="gridStats" stripe v-loading="loading" height="400">
            <el-table-column prop="gridName" label="网格" />
            <el-table-column prop="area" label="区域" width="120" show-overflow-tooltip />
            <el-table-column prop="total" label="总需求" width="70" />
            <el-table-column prop="completed" label="完成" width="60" />
            <el-table-column prop="existingResourceCompleted" label="存量" width="60" />
            <el-table-column prop="constructionBuildCompleted" label="施工" width="60" />
            <el-table-column prop="timeout" label="超时" width="60">
              <template #default="{ row }">
                <span :class="{ 'text-danger': row.timeout > 0 }">{{ row.timeout }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="completionRate" label="完成率" width="75">
              <template #default="{ row }">
                {{ (row.completionRate * 100).toFixed(1) }}%
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted, watch } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { getAreaStats, getGridStats, getStatusSummary } from '@/api/stats'
import type { AreaStats, GridStats } from '@/types'
import type { StatusSummaryItem } from '@/api/stats'
import * as echarts from 'echarts'
import { useDistrictStore } from '@/stores/district'

const districtStore = useDistrictStore()

const loading = ref(false)
const timeRange = ref('month')

const areaStats = ref<AreaStats[]>([])
const gridStats = ref<GridStats[]>([])
const statusSummary = ref<StatusSummaryItem[]>([])

const areaChartRef = ref<HTMLElement>()
const statusChartRef = ref<HTMLElement>()
let areaChart: echarts.ECharts | null = null
let statusChart: echarts.ECharts | null = null

// 汇总指标
const totalCount = computed(() => areaStats.value.reduce((s, a) => s + a.total, 0))
const completedCount = computed(() => areaStats.value.reduce((s, a) => s + a.completed, 0))
const inProgressCount = computed(() => areaStats.value.reduce((s, a) => s + (a.inProgress || 0), 0))
const timeoutCount = computed(() => areaStats.value.reduce((s, a) => s + a.timeout, 0))

const initCharts = () => {
  if (areaChartRef.value) {
    areaChart = echarts.init(areaChartRef.value)
  }
  if (statusChartRef.value) {
    statusChart = echarts.init(statusChartRef.value)
  }
}

const updateAreaChart = () => {
  if (!areaChart) return

  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: areaStats.value.map(s => s.area),
      axisLabel: { rotate: 15, fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value}%' }
    },
    series: [{
      type: 'bar',
      data: areaStats.value.map(s => ({
        value: Number((s.completionRate * 100).toFixed(1)),
        itemStyle: { color: s.timeout > 0 ? '#E6A23C' : '#1E6F3F' }
      })),
      barWidth: '55%',
      label: { show: true, position: 'top', formatter: '{c}%' }
    }]
  }

  areaChart.setOption(option)
}

const STATUS_COLORS: Record<string, string> = {
  '已开通': '#52C41A',
  '施工中': '#1890FF',
  '设计中': '#722ED1',
  '待审核': '#FAAD14',
  '待确认': '#13C2C2',
  '已驳回': '#F5222D'
}

const updateStatusChart = () => {
  if (!statusChart) return

  const data = statusSummary.value.map(item => ({
    name: item.status,
    value: item.count,
    itemStyle: { color: STATUS_COLORS[item.status] || '#8C8C8C' }
  })).filter(d => d.value > 0)

  const option: echarts.EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
    legend: { bottom: 5, left: 'center', type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      avoidLabelOverlap: true,
      label: { show: true, formatter: '{b}\n{c}单' },
      emphasis: { label: { show: true, fontWeight: 'bold' } },
      data
    }]
  }

  statusChart.setOption(option)
}

const loadStats = async () => {
  loading.value = true
  try {
    const params = { range: timeRange.value, district: districtStore.apiDistrict ?? undefined }
    const [areaData, gridData, statusData] = await Promise.all([
      getAreaStats(params),
      getGridStats(params),
      getStatusSummary(params)
    ])
    areaStats.value = areaData
    gridStats.value = gridData
    statusSummary.value = statusData

    await nextTick()
    updateAreaChart()
    updateStatusChart()
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

watch(() => districtStore.apiDistrict, () => { loadStats() })

const exportStats = () => {
  const rangeLabel: Record<string, string> = { week: '本周', month: '本月', quarter: '本季', year: '本年' }
  const label = rangeLabel[timeRange.value] || timeRange.value

  const lines = ['\ufeff区域,总需求,已完成,进行中,超时数,完成率']
  areaStats.value.forEach(row => {
    lines.push([
      `"${row.area}"`,
      row.total,
      row.completed,
      row.inProgress || 0,
      row.timeout,
      `${(row.completionRate * 100).toFixed(1)}%`
    ].join(','))
  })
  lines.push('')
  lines.push('\ufeff网格,区域,总需求,已完成,超时数,完成率')
  gridStats.value.forEach(row => {
    lines.push([
      `"${row.gridName}"`,
      `"${row.area}"`,
      row.total,
      row.completed,
      row.timeout,
      `${(row.completionRate * 100).toFixed(1)}%`
    ].join(','))
  })

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `统计报表_${label}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const handleResize = () => {
  areaChart?.resize()
  statusChart?.resize()
}

onMounted(() => {
  initCharts()
  loadStats()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  areaChart?.dispose()
  statusChart?.dispose()
})
</script>

<style scoped>
.stats-view {
  max-width: 1400px;
}

.filter-bar {
  margin-bottom: 20px;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-row {
  margin-bottom: 20px;
}

.summary-card {
  text-align: center;
  padding: 8px 0;
}

.summary-num {
  font-size: 32px;
  font-weight: bold;
  line-height: 1.2;
  color: #303133;
}

.summary-label {
  font-size: 13px;
  color: #909399;
  margin-top: 4px;
}

.chart-row {
  margin-bottom: 20px;
}

.table-row {
  margin-bottom: 20px;
}

.chart-container {
  width: 100%;
  height: 300px;
}

.text-success { color: #52C41A; }
.text-primary { color: #1890FF; }
.text-danger  { color: #F56C6C; font-weight: bold; }
</style>
