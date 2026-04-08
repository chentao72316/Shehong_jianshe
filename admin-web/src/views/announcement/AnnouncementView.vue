<template>
  <div class="announcement-view">
    <el-card class="toolbar">
      <el-button type="primary" @click="openCreate">新建公告</el-button>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
        <el-table-column label="内容" min-width="300" show-overflow-tooltip>
          <template #default="{ row }">{{ row.content }}</template>
        </el-table-column>
        <el-table-column label="生效时间" width="160">
          <template #default="{ row }">{{ formatDate(row.startTime) }}</template>
        </el-table-column>
        <el-table-column label="失效时间" width="160">
          <template #default="{ row }">{{ row.endTime ? formatDate(row.endTime) : '永久有效' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.active ? 'success' : 'info'" size="small">
              {{ row.active ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="160">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link size="small" @click="handleToggle(row)">
              {{ row.active ? '停用' : '启用' }}
            </el-button>
            <el-button link size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="loadList"
        @size-change="() => { currentPage = 1; loadList() }"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 新建公告弹窗 -->
    <el-dialog v-model="dialogVisible" title="新建公告" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="公告标题" required>
          <el-input v-model="form.title" placeholder="请输入公告标题" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="公告内容" required>
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="5"
            placeholder="请输入公告内容"
            maxlength="2000"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="生效时间">
          <el-date-picker
            v-model="form.startTime"
            type="datetime"
            placeholder="默认为立即生效"
            format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="失效时间">
          <el-date-picker
            v-model="form.endTime"
            type="datetime"
            placeholder="留空表示永久有效"
            format="YYYY-MM-DD HH:mm"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">发布公告</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getAnnouncementAdminList,
  createAnnouncement,
  toggleAnnouncement,
  deleteAnnouncement,
  type Announcement
} from '@/api/announcement'

const loading = ref(false)
const submitting = ref(false)
const dialogVisible = ref(false)

const list = ref<Announcement[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const form = ref({
  title: '',
  content: '',
  startTime: null as Date | null,
  endTime: null as Date | null
})

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const loadList = async () => {
  loading.value = true
  try {
    const data = await getAnnouncementAdminList({ page: currentPage.value, pageSize: pageSize.value })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  form.value = { title: '', content: '', startTime: null, endTime: null }
  dialogVisible.value = true
}

const handleCreate = async () => {
  if (!form.value.title.trim()) { ElMessage.warning('请填写公告标题'); return }
  if (!form.value.content.trim()) { ElMessage.warning('请填写公告内容'); return }
  submitting.value = true
  try {
    await createAnnouncement({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      startTime: form.value.startTime ? form.value.startTime.toISOString() : undefined,
      endTime: form.value.endTime ? form.value.endTime.toISOString() : undefined
    })
    ElMessage.success('公告发布成功，已推送站内消息给所有用户')
    dialogVisible.value = false
    loadList()
  } catch {
    ElMessage.error('发布失败，请重试')
  } finally {
    submitting.value = false
  }
}

const handleToggle = async (row: Announcement) => {
  await toggleAnnouncement(row._id, !row.active)
  row.active = !row.active
  ElMessage.success(row.active ? '公告已启用' : '公告已停用')
}

const handleDelete = async (row: Announcement) => {
  await ElMessageBox.confirm(`确定删除公告「${row.title}」吗？`, '确认删除', { type: 'warning' })
  await deleteAnnouncement(row._id)
  ElMessage.success('删除成功')
  loadList()
}

onMounted(loadList)
</script>

<style scoped>
.announcement-view { max-width: 1200px; }
.toolbar { margin-bottom: 20px; }
</style>
