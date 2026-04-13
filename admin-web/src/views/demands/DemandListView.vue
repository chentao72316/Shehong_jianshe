<template>
  <div class="demand-list-view">
    <!-- 搜索栏 -->
    <el-card class="search-bar">
      <el-row :gutter="12" align="middle">
        <el-col :span="5">
          <el-input
            v-model="searchKeyword"
            placeholder="工单编号 / 申请人 / 位置"
            clearable
            @clear="handleSearch"
            @keyup.enter="handleSearch"
          />
        </el-col>
        <el-col :span="8">
          <el-radio-group v-model="searchStage" size="default" @change="handleSearch">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="pending">待处理</el-radio-button>
            <el-radio-button value="design">设计阶段</el-radio-button>
            <el-radio-button value="construction">施工阶段</el-radio-button>
            <el-radio-button value="opened">已开通</el-radio-button>
          </el-radio-group>
        </el-col>
        <el-col :span="3">
          <el-select v-model="searchType" placeholder="需求类型" clearable @change="handleSearch" style="width: 100%">
            <el-option label="新建" value="新建" />
            <el-option label="扩容" value="扩容" />
            <el-option label="改造" value="改造" />
            <el-option label="应急" value="应急" />
          </el-select>
        </el-col>
        <el-col :span="3">
          <el-input v-model="searchArea" placeholder="受理区域" clearable @clear="handleSearch" @keyup.enter="handleSearch" />
        </el-col>
      </el-row>
      <el-row :gutter="12" align="middle" style="margin-top: 10px;">
        <el-col :span="8">
          <el-date-picker
            v-model="searchDateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="提交开始日期"
            end-placeholder="提交结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            @change="handleSearch"
            clearable
            style="width: 100%"
          />
        </el-col>
        <el-col v-if="showManagementListTools" :span="4">
          <el-switch
            v-model="searchOverdueOnly"
            inline-prompt
            active-text="仅超时"
            inactive-text="全部"
            @change="handleSearch"
          />
        </el-col>
        <el-col :span="12">
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
          <el-button type="success" :loading="exporting" @click="handleExport">导出 Excel</el-button>
          <span class="total-tip">共 {{ total }} 条</span>
        </el-col>
      </el-row>
    </el-card>

    <!-- 工单列表 -->
    <el-card>
      <el-table :data="demandList" v-loading="loading" stripe>
        <el-table-column prop="demandNo" label="工单编号" width="170" fixed="left" />
        <el-table-column label="状态" width="130" fixed="left">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="acceptArea" label="受理区域" width="150" />
        <el-table-column prop="gridName" label="网格" width="140" show-overflow-tooltip />
        <el-table-column prop="businessType" label="业务" width="70" />
        <el-table-column prop="type" label="类型" width="70" />
        <el-table-column label="紧急度" width="80">
          <template #default="{ row }">
            <el-tag :type="getUrgencyType(row.urgency)" size="small">{{ row.urgency }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请人" width="100">
          <template #default="{ row }">
            {{ row.demandPersonName || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="提交人" width="100">
          <template #default="{ row }">
            {{ getUsername(row.createdBy) }}
          </template>
        </el-table-column>
        <el-table-column label="设计单位" width="100">
          <template #default="{ row }">
            {{ getUsername(row.assignedDesignUnit) || '-' }}
          </template>
        </el-table-column>
        <el-table-column v-if="showManagementListTools" label="当前责任人" width="120" show-overflow-tooltip>
          <template #default="{ row }">
            {{ getCurrentOwnerName(row) }}
          </template>
        </el-table-column>
        <el-table-column v-if="showManagementListTools" label="阶段耗时" width="120">
          <template #default="{ row }">
            {{ getCurrentStageDuration(row) }}
          </template>
        </el-table-column>
        <el-table-column v-if="showManagementListTools" label="时效状态" width="140">
          <template #default="{ row }">
            <el-tag :type="getTimeoutTagType(row)" size="small">
              {{ getTimeoutDisplayText(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="locationDetail" label="位置" show-overflow-tooltip min-width="160" />
        <el-table-column label="提交时间" width="150">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="380" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleDetail(row)">详情</el-button>
            <el-button v-if="canProcessRow(row)" type="primary" link size="small" @click="handleProcessRow(row)">去处理</el-button>
            <el-button v-if="canQuickApproveRow(row)" type="success" link size="small" @click="handleQuickApprove(row)">确认开通</el-button>
            <el-button v-if="canQuickRejectRow(row)" type="warning" link size="small" @click="handleQuickReject(row)">驳回施工</el-button>
            <el-button v-if="canQuickRemindRow(row)" type="danger" link size="small" @click="handleQuickRemind(row)">催办</el-button>
            <el-button v-if="isAdmin" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadDemands"
        @size-change="handlePageSizeChange"
        style="margin-top: 20px; justify-content: flex-end;"
      />
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="工单详情" width="1040px" top="4vh">
      <template v-if="currentDemand">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="工单编号" :span="2">{{ currentDemand.demandNo }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(currentDemand.status)">{{ currentDemand.status }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="开通方式" v-if="currentDemand.status === '已开通' && currentDemand.completionModeLabel">
            <el-tag type="success" size="small">{{ currentDemand.completionModeLabel }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="紧急度">
            <el-tag :type="getUrgencyType(currentDemand.urgency)" size="small">{{ currentDemand.urgency }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="受理区域">{{ currentDemand.acceptArea }}</el-descriptions-item>
          <el-descriptions-item label="提交网格">{{ currentDemand.gridName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="业务类型">{{ currentDemand.businessType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="需求类型">{{ currentDemand.type }}</el-descriptions-item>
          <el-descriptions-item label="网络支撑中心">{{ currentDemand.networkSupport || '-' }}</el-descriptions-item>
          <el-descriptions-item label="服务中心">{{ currentDemand.serviceCenter || '-' }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ currentDemand.demandPersonName }}</el-descriptions-item>
          <el-descriptions-item label="申请人电话">{{ currentDemand.demandPersonPhone }}</el-descriptions-item>
          <el-descriptions-item label="提交人">{{ getUsername(currentDemand.createdBy) }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ formatDate(currentDemand.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="设计单位">{{ getUsername(currentDemand.assignedDesignUnit) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="施工单位">{{ getUsername(currentDemand.assignedConstructionUnit) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="预约客户数">{{ currentDemand.reservedCustomers ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="驳回次数" v-if="currentDemand.rejectCount">{{ currentDemand.rejectCount }}</el-descriptions-item>
          <el-descriptions-item label="位置" :span="2">{{ currentDemand.locationDetail || '-' }}</el-descriptions-item>
          <el-descriptions-item
            label="完工位置"
            :span="2"
            v-if="currentDemand.constructionLat != null && currentDemand.constructionLng != null"
          >
            {{ currentDemand.constructionLat }}, {{ currentDemand.constructionLng }}
          </el-descriptions-item>
          <el-descriptions-item
            label="完工位置详细描述"
            :span="2"
            v-if="currentDemand.constructionLocationDetail"
          >
            {{ currentDemand.constructionLocationDetail }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2" v-if="currentDemand.remark">{{ currentDemand.remark }}</el-descriptions-item>
          <el-descriptions-item label="驳回原因" :span="2" v-if="currentDemand.rejectionReason">
            <span style="color: #F56C6C;">{{ currentDemand.rejectionReason }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="跨区审核人" v-if="currentDemand.crossAreaReviewerId">
            {{ getUsername(currentDemand.crossAreaReviewerId) }}
          </el-descriptions-item>
        </el-descriptions>

        <template v-if="showManagementInsight">
          <el-divider>督办视角</el-divider>
          <el-card class="insight-card" shadow="never">
            <div class="insight-grid">
              <div class="insight-item">
                <div class="insight-label">当前阶段</div>
                <div class="insight-value">{{ getCurrentStageLabel(currentDemand) }}</div>
              </div>
              <div class="insight-item">
                <div class="insight-label">当前责任人</div>
                <div class="insight-value">{{ getCurrentOwnerName(currentDemand) }}</div>
              </div>
              <div class="insight-item">
                <div class="insight-label">设计耗时</div>
                <div class="insight-value">{{ formatDurationMinutes(currentDemand.designDuration) }}</div>
              </div>
              <div class="insight-item">
                <div class="insight-label">施工耗时</div>
                <div class="insight-value">{{ formatDurationMinutes(currentDemand.constructionDuration) }}</div>
              </div>
              <div class="insight-item">
                <div class="insight-label">总耗时</div>
                <div class="insight-value">{{ formatDurationMinutes(currentDemand.totalDuration) }}</div>
              </div>
              <div class="insight-item">
                <div class="insight-label">当前阶段时效</div>
                <div class="insight-value">
                  <el-tag :type="getTimeoutTagType(currentDemand)" size="small">
                    {{ getTimeoutDisplayText(currentDemand) }}
                  </el-tag>
                </div>
              </div>
            </div>
            <div v-if="canQuickRemindRow(currentDemand)" class="insight-actions">
              <el-button type="danger" plain :loading="reminding" @click="handleQuickRemind(currentDemand)">发送催办</el-button>
            </div>
          </el-card>
        </template>

        <el-divider>现场照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">需求提交时上传的现场照片，支持点击查看大图。</div>
          <div v-if="sitePhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in sitePhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="sitePhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty v-else description="暂无现场照片" :image-size="72" />
        </div>

        <el-divider>现有资源照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">设计查勘阶段上传的现有资源照片，支持点击查看大图。</div>
          <div v-if="resourcePhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in resourcePhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="resourcePhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty
            v-else
            :description="currentDemand.hasResource ? '暂无现有资源照片' : '该工单不是现有资源场景'"
            :image-size="72"
          />
        </div>

        <el-divider>施工照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">施工完工阶段上传的现场施工照片，支持点击查看大图。</div>
          <div v-if="constructionPhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in constructionPhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="constructionPhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty v-else description="暂无施工照片" :image-size="72" />
        </div>

        <el-divider>监理验收照片</el-divider>
        <div class="detail-section">
          <div class="section-caption">监理验收阶段上传的照片，支持点击查看大图。</div>
          <div v-if="supervisorPhotoUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in supervisorPhotoUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="supervisorPhotoUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>
          <el-empty v-else description="暂无监理验收照片" :image-size="72" />
        </div>

        <template v-if="designImageUrls.length || designFileLinks.length">
          <el-divider>设计文件</el-divider>

          <div v-if="designImageUrls.length" class="photo-preview-grid">
            <el-image
              v-for="(url, index) in designImageUrls"
              :key="`${url}-${index}`"
              :src="url"
              :preview-src-list="designImageUrls"
              :initial-index="index"
              fit="cover"
              preview-teleported
              class="detail-photo"
            />
          </div>

          <div v-if="designFileLinks.length" class="file-link-list">
            <el-link
              v-for="file in designFileLinks"
              :key="file.url"
              :href="file.url"
              target="_blank"
              type="primary"
              class="file-link-item"
            >
              {{ file.name }}
            </el-link>
          </div>
        </template>

        <template v-if="canSubmitDesign || canSubmitConstruction || canSubmitSupervisor || canConfirmConstruction">
          <el-divider>执行填报</el-divider>

          <el-card v-if="canSubmitDesign" class="action-card" shadow="never">
            <template #header>
              <div class="action-card-header">设计查勘填报</div>
            </template>
            <el-form label-width="120px" class="action-form">
              <el-form-item label="300米内是否有资源">
                <el-radio-group v-model="designForm.hasResource">
                  <el-radio :value="true">有</el-radio>
                  <el-radio :value="false">无</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="现有资源名称" v-if="designForm.hasResource">
                <el-input v-model="designForm.resourceName" placeholder="请填写现有资源名称" />
              </el-form-item>
              <el-form-item label="现有资源照片">
                <el-upload
                  v-model:file-list="designResourcePhotoFiles"
                  list-type="picture-card"
                  :limit="3"
                  accept="image/*"
                  :http-request="uploadDesignResourcePhoto"
                  :on-success="handleDesignResourcePhotoChange"
                  :on-remove="handleDesignResourcePhotoRemove"
                >
                  <el-icon><Plus /></el-icon>
                </el-upload>
              </el-form-item>
              <el-form-item label="设计文件" v-if="!designForm.hasResource">
                <el-upload
                  v-model:file-list="designFileFiles"
                  multiple
                  :limit="9"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dwt,.dxf,.jpg,.jpeg,.png,.webp"
                  :http-request="uploadDesignFileRequest"
                  :on-success="handleDesignFileChange"
                  :on-remove="handleDesignFileRemove"
                >
                  <el-button type="primary" plain>上传设计文件</el-button>
                </el-upload>
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="designForm.remark" type="textarea" :rows="3" placeholder="请填写设计查勘备注" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="designSubmitting" @click="handleDesignSubmit">提交设计结果</el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <el-card v-if="canSubmitConstruction" class="action-card" shadow="never">
            <template #header>
              <div class="action-card-header">施工完工填报</div>
            </template>
            <el-form label-width="140px" class="action-form">
              <el-form-item label="覆盖点名称">
                <el-input v-model="constructionForm.coverageName" placeholder="请填写覆盖点名称" />
              </el-form-item>
              <el-form-item label="资产生效状态">
                <el-select v-model="constructionForm.assetStatus" placeholder="请选择" style="width: 100%">
                  <el-option v-for="item in assetStatusOptions" :key="item" :label="item" :value="item" />
                </el-select>
              </el-form-item>
              <el-form-item label="完工纬度">
                <el-input-number v-model="constructionForm.latitude" :precision="6" :step="0.000001" style="width: 100%" />
              </el-form-item>
              <el-form-item label="完工经度">
                <el-input-number v-model="constructionForm.longitude" :precision="6" :step="0.000001" style="width: 100%" />
              </el-form-item>
              <el-form-item label="完工位置详细描述">
                <el-input
                  v-model="constructionForm.constructionLocationDetail"
                  type="textarea"
                  :rows="3"
                  placeholder="请填写完工位置详细描述"
                />
              </el-form-item>
              <el-form-item label="施工照片">
                <el-upload
                  v-model:file-list="constructionPhotoFiles"
                  list-type="picture-card"
                  :limit="9"
                  accept="image/*"
                  :http-request="uploadConstructionPhoto"
                  :on-success="handleConstructionPhotoChange"
                  :on-remove="handleConstructionPhotoRemove"
                >
                  <el-icon><Plus /></el-icon>
                </el-upload>
              </el-form-item>
              <el-form-item label="备注">
                <el-input v-model="constructionForm.remark" type="textarea" :rows="3" placeholder="请填写施工备注" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="constructionSubmitting" @click="handleConstructionSubmit">提交施工结果</el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <el-card v-if="canSubmitSupervisor" class="action-card" shadow="never">
            <template #header>
              <div class="action-card-header">监理验收填报</div>
            </template>
            <el-form label-width="120px" class="action-form">
              <el-form-item label="验收照片">
                <el-upload
                  v-model:file-list="supervisorPhotoFiles"
                  list-type="picture-card"
                  :limit="9"
                  accept="image/*"
                  :http-request="uploadSupervisorPhoto"
                  :on-success="handleSupervisorPhotoChange"
                  :on-remove="handleSupervisorPhotoRemove"
                >
                  <el-icon><Plus /></el-icon>
                </el-upload>
              </el-form-item>
              <el-form-item label="验收备注">
                <el-input v-model="supervisorForm.remark" type="textarea" :rows="3" placeholder="请填写监理验收备注" />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="supervisorSubmitting" @click="handleSupervisorSubmit">提交监理验收</el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <el-card v-if="canConfirmConstruction" class="action-card" shadow="never">
            <template #header>
              <div class="action-card-header">开通确认</div>
            </template>
            <el-form label-width="120px" class="action-form">
              <el-form-item label="处理结果">
                <el-radio-group v-model="confirmForm.action">
                  <el-radio value="approve">确认开通</el-radio>
                  <el-radio value="reject">驳回施工</el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="驳回原因" v-if="confirmForm.action === 'reject'">
                <el-input
                  v-model="confirmForm.rejectReason"
                  type="textarea"
                  :rows="3"
                  placeholder="请填写驳回施工原因"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="confirmSubmitting" @click="handleConfirmSubmit">
                  {{ confirmForm.action === 'approve' ? '确认开通' : '提交驳回' }}
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </template>

        <el-divider>流程记录</el-divider>
        <el-timeline v-if="currentDemand.logs?.length">
          <el-timeline-item
            v-for="(log, index) in currentDemand.logs"
            :key="index"
            :timestamp="formatDate(log.time || log.createdAt)"
            placement="top"
          >
            <span style="font-size:13px;">{{ log.content || log.action }}</span>
            <span v-if="log.operator || log.operatorName" style="margin-left:8px; color:#909399; font-size:12px;">
              — {{ log.operator || log.operatorName }}
            </span>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="暂无流程记录" />
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type UploadRequestOptions, type UploadUserFile } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getDemandList,
  getDemandDetail,
  exportDemands,
  deleteDemand,
  submitConstruction,
  submitDesign,
  submitSupervisor
} from '@/api/demand'
import { confirmDemand } from '@/api/intervene'
import { sendRemind } from '@/api/timeout'
import { uploadAttachment } from '@/api/upload'
import { useUserStore } from '@/stores/user'
import { useDistrictStore } from '@/stores/district'
import type { Demand } from '@/types'

type LocalUploadFile = UploadUserFile & { rawUrl?: string }

const userStore = useUserStore()
const districtStore = useDistrictStore()
const route = useRoute()
const router = useRouter()
const isAdmin = userStore.isAdmin()

const loading = ref(false)
const exporting = ref(false)
const detailVisible = ref(false)
const currentDemand = ref<Demand | null>(null)
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
const assetStatusOptions = ['已生效', '待生效', '未生效']

const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchKeyword = ref('')
const searchStage = ref('')
const searchType = ref('')
const searchArea = ref('')
const searchDateRange = ref<[string, string] | null>(null)
const searchOverdueOnly = ref(false)
const pendingDetailId = ref('')

const demandList = ref<Demand[]>([])
const designSubmitting = ref(false)
const constructionSubmitting = ref(false)
const supervisorSubmitting = ref(false)
const confirmSubmitting = ref(false)
const reminding = ref(false)

const designForm = ref({
  hasResource: false,
  resourceName: '',
  remark: ''
})
const constructionForm = ref({
  coverageName: '',
  assetStatus: '',
  latitude: null as number | null,
  longitude: null as number | null,
  constructionLocationDetail: '',
  remark: ''
})
const supervisorForm = ref({
  remark: ''
})
const confirmForm = ref({
  action: 'approve' as 'approve' | 'reject',
  rejectReason: ''
})

const designResourcePhotoFiles = ref<LocalUploadFile[]>([])
const designFileFiles = ref<LocalUploadFile[]>([])
const constructionPhotoFiles = ref<LocalUploadFile[]>([])
const supervisorPhotoFiles = ref<LocalUploadFile[]>([])

const getAttachmentBaseUrl = () => {
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    return apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  }
  return window.location.origin
}

const shouldRewriteLegacyLocalUrl = (url: URL) => {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname) || /^192\.168\./.test(url.hostname)
}

const normalizeAttachmentUrl = (url?: string) => {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsedUrl = new URL(url)
      if (shouldRewriteLegacyLocalUrl(parsedUrl) && parsedUrl.pathname.startsWith('/uploads/')) {
        return `${getAttachmentBaseUrl()}${parsedUrl.pathname}${parsedUrl.search}`
      }
      return url
    } catch {
      return url
    }
  }
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`
  return `${getAttachmentBaseUrl()}${normalizedUrl}`
}

const getFileNameFromUrl = (url: string) => {
  const pathname = url.split('?')[0]
  return pathname.split('/').pop() || '附件'
}

const isImageFile = (url: string) => {
  return /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url.split('?')[0])
}

const createUploadFile = (url: string, index: number): LocalUploadFile => ({
  uid: -(index + 1),
  name: getFileNameFromUrl(url),
  status: 'success',
  url: normalizeAttachmentUrl(url),
  rawUrl: url
})

const extractUploadUrls = (files: LocalUploadFile[]) => {
  return files
    .map((file) => file.rawUrl || (file.response as { url?: string } | undefined)?.url || file.url || '')
    .filter(Boolean)
}

const syncUploadFileList = (files: UploadUserFile[], target: { value: LocalUploadFile[] }) => {
  target.value = files.map((file, index) => ({
    ...(file as LocalUploadFile),
    rawUrl: (file as LocalUploadFile).rawUrl || (file.response as { url?: string } | undefined)?.url || file.url || '',
    url: file.url || normalizeAttachmentUrl((file.response as { url?: string } | undefined)?.url || (file as LocalUploadFile).rawUrl || ''),
    uid: typeof file.uid === 'number' ? file.uid : index + 1
  }))
}

const makeUploadRequest = (fileType: 'image' | 'file') => async (options: UploadRequestOptions) => {
  try {
    const result = await uploadAttachment(options.file as File, fileType)
    options.onSuccess?.(result)
  } catch (error) {
    options.onError?.(error as never)
  }
}

const uploadDesignResourcePhoto = makeUploadRequest('image')
const uploadDesignFileRequest = makeUploadRequest('file')
const uploadConstructionPhoto = makeUploadRequest('image')
const uploadSupervisorPhoto = makeUploadRequest('image')

const handleDesignResourcePhotoChange = (_response: unknown, _file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, designResourcePhotoFiles)
}

const handleDesignResourcePhotoRemove = (_file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, designResourcePhotoFiles)
}

const handleDesignFileChange = (_response: unknown, _file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, designFileFiles)
}

const handleDesignFileRemove = (_file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, designFileFiles)
}

const handleConstructionPhotoChange = (_response: unknown, _file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, constructionPhotoFiles)
}

const handleConstructionPhotoRemove = (_file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, constructionPhotoFiles)
}

const handleSupervisorPhotoChange = (_response: unknown, _file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, supervisorPhotoFiles)
}

const handleSupervisorPhotoRemove = (_file: UploadUserFile, files: UploadUserFile[]) => {
  syncUploadFileList(files, supervisorPhotoFiles)
}

const resourcePhotoUrls = computed(() => {
  return (currentDemand.value?.resourcePhotos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const sitePhotoUrls = computed(() => {
  return (currentDemand.value?.photos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const constructionPhotoUrls = computed(() => {
  return (currentDemand.value?.constructionPhotos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const supervisorPhotoUrls = computed(() => {
  return (currentDemand.value?.supervisorPhotos || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const normalizedDesignFileUrls = computed(() => {
  return (currentDemand.value?.designFiles || [])
    .map((item) => normalizeAttachmentUrl(item))
    .filter(Boolean)
})

const designImageUrls = computed(() => {
  return normalizedDesignFileUrls.value.filter((url) => isImageFile(url))
})

const designFileLinks = computed(() => {
  return normalizedDesignFileUrls.value
    .filter((url) => !isImageFile(url))
    .map((url) => ({
      url,
      name: getFileNameFromUrl(url)
    }))
})

const currentUserPhone = computed(() => userStore.userInfo?.phone || '')
const canManageReminder = computed(() => userStore.isAdmin() || userStore.isDistrictAdmin() || userStore.isLevel4Manager() || userStore.isNetworkManager())
const showManagementListTools = computed(() => canManageReminder.value)
const showManagementInsight = computed(() => Boolean(
  currentDemand.value && (userStore.isAdmin() || userStore.isDistrictAdmin() || userStore.isLevel4Manager() || userStore.isNetworkManager())
))

const isAssignedToMe = (value: unknown) => {
  if (!value) return false
  if (typeof value === 'object') {
    const record = value as { phone?: string; id?: string; _id?: string }
    return record.phone === currentUserPhone.value || record.id === userStore.userInfo?.id || record._id === userStore.userInfo?.id
  }
  return String(value) === userStore.userInfo?.id
}

const canSubmitDesign = computed(() => Boolean(currentDemand.value && userStore.isDesign() && isAssignedToMe(currentDemand.value.assignedDesignUnit) && currentDemand.value.status === '设计中'))
const canSubmitConstruction = computed(() => Boolean(currentDemand.value && userStore.isConstruction() && isAssignedToMe(currentDemand.value.assignedConstructionUnit) && currentDemand.value.status === '施工中'))
const canSubmitSupervisor = computed(() => Boolean(
  currentDemand.value &&
  userStore.isSupervisor() &&
  isAssignedToMe(currentDemand.value.assignedSupervisor) &&
  ['待确认', '已开通'].includes(currentDemand.value.status)
))
const canConfirmConstruction = computed(() => Boolean(
  currentDemand.value &&
  userStore.isNetworkManager() &&
  currentDemand.value.status === '待确认'
))

const canProcessRow = (row: Demand) => {
  if (userStore.isDesign()) {
    return row.status === '设计中' && isAssignedToMe(row.assignedDesignUnit)
  }
  if (userStore.isConstruction()) {
    return row.status === '施工中' && isAssignedToMe(row.assignedConstructionUnit)
  }
  if (userStore.isSupervisor()) {
    return ['待确认', '已开通'].includes(row.status) && isAssignedToMe(row.assignedSupervisor)
  }
  return false
}

const canQuickApproveRow = (row: Demand) => {
  return (userStore.isNetworkManager() || userStore.isAdmin()) && row.status === '待确认'
}

const canQuickRejectRow = (row: Demand) => {
  return (userStore.isNetworkManager() || userStore.isAdmin()) && row.status === '待确认'
}

// 阶段 -> 状态映射
const stageStatusMap: Record<string, string[]> = {
  pending: ['待审核', '待确认'],
  design: ['设计中'],
  construction: ['施工中', '待确认'],
  opened: ['已开通']
}

const getStatusType = (status: string) => {
  if (status === '待审核' || status === '待确认') return 'warning'
  if (status === '已开通') return 'success'
  if (status === '已驳回') return 'danger'
  return ''
}

const getUrgencyType = (urgency: string) => {
  if (urgency === '紧急') return 'warning'
  if (urgency === '特急') return 'danger'
  return 'info'
}

const getUsername = (val: any): string => {
  if (!val) return ''
  if (typeof val === 'object' && val.name) return val.name
  if (typeof val === 'string') return val
  return ''
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const getElapsedMinutes = (start?: string, end?: Date) => {
  if (!start) return null
  const startTime = new Date(start)
  if (isNaN(startTime.getTime())) return null
  const endTime = end || new Date()
  return Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 60000))
}

const formatDurationMinutes = (minutes?: number | null) => {
  if (minutes == null || Number.isNaN(minutes)) return '-'
  if (minutes <= 0) return '0分钟'
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const segments: string[] = []
  if (days) segments.push(`${days}天`)
  if (hours) segments.push(`${hours}小时`)
  if (mins || segments.length === 0) segments.push(`${mins}分钟`)
  return segments.join('')
}

const getCurrentStageLabel = (demand: Demand) => {
  switch (demand.status) {
    case '设计中':
      return '设计阶段'
    case '施工中':
      return '施工阶段'
    case '待确认':
      return '确认阶段'
    case '待监理验收':
    case '监理验收中':
      return '监理阶段'
    case '已开通':
      return '已完成'
    case '已驳回':
      return '已驳回'
    default:
      return demand.status || '-'
  }
}

const getCurrentOwnerName = (demand: Demand) => {
  if (['设计中'].includes(demand.status)) return getUsername(demand.assignedDesignUnit) || '-'
  if (['施工中'].includes(demand.status)) return getUsername(demand.assignedConstructionUnit) || '-'
  if (['待监理验收', '监理验收中'].includes(demand.status)) return getUsername(demand.assignedSupervisor) || '-'
  if (demand.status === '待确认') return getUsername(demand.networkManager) || demand.networkSupport || '-'
  if (demand.status === '已开通') return getUsername(demand.confirmBy) || '已确认开通'
  return getUsername(demand.createdBy) || '-'
}

const getCurrentStageDuration = (demand: Demand) => {
  if (demand.status === '设计中') {
    return formatDurationMinutes(getElapsedMinutes(demand.designAssignTime))
  }
  if (demand.status === '施工中') {
    return formatDurationMinutes(getElapsedMinutes(demand.constructionAssignTime))
  }
  if (demand.status === '待确认') {
    return formatDurationMinutes(demand.constructionDuration)
  }
  return '-'
}

const getTimeoutMeta = (demand: Demand) => {
  if (demand.status === '设计中') {
    const elapsedMinutes = getElapsedMinutes(demand.designAssignTime)
    if (elapsedMinutes == null) return null
    const limitMinutes = 2 * 24 * 60
    const overdueMinutes = Math.max(0, elapsedMinutes - limitMinutes)
    return {
      overdue: overdueMinutes > 0,
      label: overdueMinutes > 0 ? `设计超时 ${Math.ceil(overdueMinutes / 1440)} 天` : `距超时 ${Math.max(0, Math.ceil((limitMinutes - elapsedMinutes) / 1440))} 天`
    }
  }
  if (demand.status === '施工中') {
    const elapsedMinutes = getElapsedMinutes(demand.constructionAssignTime)
    if (elapsedMinutes == null) return null
    const limitMinutes = 5 * 24 * 60
    const overdueMinutes = Math.max(0, elapsedMinutes - limitMinutes)
    return {
      overdue: overdueMinutes > 0,
      label: overdueMinutes > 0 ? `施工超时 ${Math.ceil(overdueMinutes / 1440)} 天` : `距超时 ${Math.max(0, Math.ceil((limitMinutes - elapsedMinutes) / 1440))} 天`
    }
  }
  return null
}

const getTimeoutDisplayText = (demand: Demand) => {
  const timeoutMeta = getTimeoutMeta(demand)
  return timeoutMeta?.label || '当前阶段未纳入催办'
}

const getTimeoutTagType = (demand: Demand) => {
  const timeoutMeta = getTimeoutMeta(demand)
  if (!timeoutMeta) return 'info'
  return timeoutMeta.overdue ? 'danger' : 'success'
}

const canQuickRemindRow = (row: Demand) => {
  const timeoutMeta = getTimeoutMeta(row)
  return Boolean(canManageReminder.value && timeoutMeta?.overdue)
}

const syncActionForms = (demand: Demand) => {
  designForm.value = {
    hasResource: Boolean(demand.hasResource),
    resourceName: demand.resourceName || '',
    remark: demand.designRemark || ''
  }
  constructionForm.value = {
    coverageName: demand.coverageName || '',
    assetStatus: demand.assetStatus || '',
    latitude: demand.constructionLat ?? null,
    longitude: demand.constructionLng ?? null,
    constructionLocationDetail: demand.constructionLocationDetail || '',
    remark: demand.constructionRemark || ''
  }
  supervisorForm.value = {
    remark: demand.supervisorRemark || ''
  }
  confirmForm.value = {
    action: 'approve',
    rejectReason: ''
  }
  designResourcePhotoFiles.value = (demand.resourcePhotos || []).map((url, index) => createUploadFile(url, index))
  designFileFiles.value = (demand.designFiles || []).map((url, index) => createUploadFile(url, index))
  constructionPhotoFiles.value = (demand.constructionPhotos || []).map((url, index) => createUploadFile(url, index))
  supervisorPhotoFiles.value = (demand.supervisorPhotos || []).map((url, index) => createUploadFile(url, index))
}

const getCurrentDemandId = () => {
  return currentDemand.value?.id || (currentDemand.value as Demand & { _id?: string } | null)?._id || ''
}

const refreshCurrentDemand = async () => {
  const demandId = getCurrentDemandId()
  if (!demandId) return
  currentDemand.value = await getDemandDetail(demandId)
  syncActionForms(currentDemand.value)
}

const applyRouteFilters = () => {
  const stageQuery = typeof route.query.stage === 'string' ? route.query.stage : ''
  const areaQuery = typeof route.query.area === 'string' ? route.query.area : ''
  const keywordQuery = typeof route.query.keyword === 'string' ? route.query.keyword : ''
  const overdueQuery = route.query.overdueOnly
  const detailIdQuery = typeof route.query.detailId === 'string' ? route.query.detailId : ''

  searchStage.value = ['pending', 'design', 'construction', 'opened'].includes(stageQuery) ? stageQuery : ''
  searchArea.value = areaQuery
  searchKeyword.value = keywordQuery
  searchOverdueOnly.value = overdueQuery === '1' || overdueQuery === 'true'
  pendingDetailId.value = detailIdQuery
}

const loadDemands = async () => {
  loading.value = true
  try {
    const data = await getDemandList({
      page: currentPage.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
      status: searchStage.value ? stageStatusMap[searchStage.value] : undefined,
      type: searchType.value || undefined,
      area: searchArea.value || undefined,
      dateFrom: searchDateRange.value?.[0] || undefined,
      dateTo: searchDateRange.value?.[1] || undefined,
      district: districtStore.apiDistrict ?? undefined,
      overdueOnly: showManagementListTools.value ? searchOverdueOnly.value : undefined
    })
    demandList.value = data.list
    total.value = data.total
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }

  if (pendingDetailId.value) {
    await openDetailFromRoute()
  }
}

const handleSearch = () => {
  currentPage.value = 1
  loadDemands()
}

const handleReset = () => {
  searchKeyword.value = ''
  searchStage.value = ''
  searchType.value = ''
  searchArea.value = ''
  searchDateRange.value = null
  searchOverdueOnly.value = false
  currentPage.value = 1
  loadDemands()
}

const handlePageSizeChange = () => {
  currentPage.value = 1
  loadDemands()
}

const handleDetail = async (row: Demand) => {
  try {
    currentDemand.value = await getDemandDetail(row.id || (row as any)._id)
    syncActionForms(currentDemand.value)
    detailVisible.value = true
  } catch (error) {
    console.error(error)
  }
}

const clearPendingDetailQuery = async () => {
  if (!pendingDetailId.value || typeof route.query.detailId !== 'string') return
  const nextQuery = { ...route.query }
  delete nextQuery.detailId
  pendingDetailId.value = ''
  await router.replace({ path: route.path, query: nextQuery })
}

const openDetailFromRoute = async () => {
  if (!pendingDetailId.value) return
  try {
    currentDemand.value = await getDemandDetail(pendingDetailId.value)
    syncActionForms(currentDemand.value)
    detailVisible.value = true
  } catch (error) {
    console.error(error)
  } finally {
    await clearPendingDetailQuery()
  }
}

const handleExport = async () => {
  exporting.value = true
  try {
    await exportDemands({
      keyword: searchKeyword.value || undefined,
      status: searchStage.value ? stageStatusMap[searchStage.value] : undefined,
      type: searchType.value || undefined,
      area: searchArea.value || undefined,
      dateFrom: searchDateRange.value?.[0] || undefined,
      dateTo: searchDateRange.value?.[1] || undefined,
      district: districtStore.apiDistrict ?? undefined,
      overdueOnly: showManagementListTools.value ? searchOverdueOnly.value : undefined
    })
  } catch {
    ElMessage.error('导出失败，请重试')
  } finally {
    exporting.value = false
  }
}

const handleDelete = async (row: Demand) => {
  const id = row.id || (row as any)._id
  try {
    await ElMessageBox.confirm(`确定删除工单「${row.demandNo}」吗？删除后不可恢复。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteDemand(id)
    ElMessage.success('删除成功')
    loadDemands()
  } catch {
    // 用户取消或删除失败已在拦截器处理
  }
}

const handleProcessRow = async (row: Demand) => {
  await handleDetail(row)
}

const handleQuickApprove = async (row: Demand) => {
  const demandId = row.id || (row as Demand & { _id?: string })._id
  if (!demandId) return

  try {
    await ElMessageBox.confirm(`确认将工单「${row.demandNo}」开通吗？`, '开通确认', {
      confirmButtonText: '确认开通',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await confirmDemand({ demandId, action: 'approve' })
    ElMessage.success('已确认开通')
    await loadDemands()
    if (currentDemand.value && getCurrentDemandId() === demandId) {
      await refreshCurrentDemand()
    }
  } catch (error) {
    if (error !== 'cancel') console.error(error)
  }
}

const handleQuickReject = async (row: Demand) => {
  const demandId = row.id || (row as Demand & { _id?: string })._id
  if (!demandId) return

  try {
    const { value } = await ElMessageBox.prompt('请填写驳回施工原因', '驳回施工', {
      confirmButtonText: '提交驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: (inputValue: string) => Boolean(inputValue.trim()),
      inputErrorMessage: '驳回原因不能为空'
    })
    await confirmDemand({ demandId, action: 'reject', rejectReason: value.trim() })
    ElMessage.success('已驳回施工')
    await loadDemands()
    if (currentDemand.value && getCurrentDemandId() === demandId) {
      await refreshCurrentDemand()
    }
  } catch (error) {
    if (error !== 'cancel') console.error(error)
  }
}

const handleQuickRemind = async (row: Demand) => {
  const demandId = row.id || (row as Demand & { _id?: string })._id
  if (!demandId) return

  reminding.value = true
  try {
    await ElMessageBox.confirm(`确定向工单「${row.demandNo}」的责任单位发送催办提醒吗？\n${getTimeoutDisplayText(row)}`, '催办确认', {
      confirmButtonText: '发送催办',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await sendRemind(demandId)
    ElMessage.success('催办提醒已发送')
    if (currentDemand.value && getCurrentDemandId() === demandId) {
      await refreshCurrentDemand()
    }
  } catch (error) {
    if (error !== 'cancel') console.error(error)
  } finally {
    reminding.value = false
  }
}

const handleDesignSubmit = async () => {
  const demandId = getCurrentDemandId()
  if (!demandId) return
  if (designForm.value.hasResource && !designForm.value.resourceName.trim()) {
    ElMessage.warning('请填写现有资源名称')
    return
  }
  if (!designForm.value.hasResource && extractUploadUrls(designFileFiles.value).length === 0) {
    ElMessage.warning('无资源场景请上传设计文件')
    return
  }

  designSubmitting.value = true
  try {
    await submitDesign({
      demandId,
      hasResource: designForm.value.hasResource,
      resourceName: designForm.value.resourceName.trim(),
      resourcePhotos: extractUploadUrls(designResourcePhotoFiles.value),
      designFiles: extractUploadUrls(designFileFiles.value),
      remark: designForm.value.remark.trim()
    })
    ElMessage.success('设计结果已提交')
    await refreshCurrentDemand()
    await loadDemands()
  } catch (error) {
    console.error(error)
  } finally {
    designSubmitting.value = false
  }
}

const handleConstructionSubmit = async () => {
  const demandId = getCurrentDemandId()
  if (!demandId) return
  if (!constructionForm.value.coverageName.trim()) {
    ElMessage.warning('请填写覆盖点名称')
    return
  }
  if (!constructionForm.value.assetStatus) {
    ElMessage.warning('请选择资产状态')
    return
  }

  constructionSubmitting.value = true
  try {
    const hasLocation = constructionForm.value.latitude != null && constructionForm.value.longitude != null
    await submitConstruction({
      demandId,
      coverageName: constructionForm.value.coverageName.trim(),
      assetStatus: constructionForm.value.assetStatus,
      location: hasLocation
        ? {
            latitude: Number(constructionForm.value.latitude),
            longitude: Number(constructionForm.value.longitude)
          }
        : null,
      constructionLocationDetail: constructionForm.value.constructionLocationDetail.trim(),
      photos: extractUploadUrls(constructionPhotoFiles.value),
      remark: constructionForm.value.remark.trim()
    })
    ElMessage.success('施工结果已提交')
    await refreshCurrentDemand()
    await loadDemands()
  } catch (error) {
    console.error(error)
  } finally {
    constructionSubmitting.value = false
  }
}

const handleSupervisorSubmit = async () => {
  const demandId = getCurrentDemandId()
  if (!demandId) return
  if (extractUploadUrls(supervisorPhotoFiles.value).length === 0 && !supervisorForm.value.remark.trim()) {
    ElMessage.warning('请至少上传验收照片或填写验收备注')
    return
  }

  supervisorSubmitting.value = true
  try {
    await submitSupervisor({
      demandId,
      photos: extractUploadUrls(supervisorPhotoFiles.value),
      remark: supervisorForm.value.remark.trim()
    })
    ElMessage.success('监理验收已提交')
    await refreshCurrentDemand()
    await loadDemands()
  } catch (error) {
    console.error(error)
  } finally {
    supervisorSubmitting.value = false
  }
}

const handleConfirmSubmit = async () => {
  const demandId = getCurrentDemandId()
  if (!demandId) return
  if (confirmForm.value.action === 'reject' && !confirmForm.value.rejectReason.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }

  confirmSubmitting.value = true
  try {
    await confirmDemand({
      demandId,
      action: confirmForm.value.action,
      rejectReason: confirmForm.value.action === 'reject' ? confirmForm.value.rejectReason.trim() : undefined
    })
    ElMessage.success(confirmForm.value.action === 'approve' ? '已确认开通' : '已驳回施工')
    await refreshCurrentDemand()
    await loadDemands()
  } catch (error) {
    console.error(error)
  } finally {
    confirmSubmitting.value = false
  }
}

onMounted(() => {
  applyRouteFilters()
  loadDemands()
})

// 区县切换时重置并刷新
watch(() => districtStore.apiDistrict, () => {
  currentPage.value = 1
  loadDemands()
})

watch(() => route.query, () => {
  applyRouteFilters()
  currentPage.value = 1
  loadDemands()
})
</script>

<style scoped>
.demand-list-view {
  max-width: 1600px;
}

.search-bar {
  margin-bottom: 20px;
}

.total-tip {
  margin-left: 12px;
  font-size: 14px;
  color: #909399;
}

.detail-section {
  margin-bottom: 4px;
}

.section-caption {
  margin-bottom: 12px;
  font-size: 13px;
  line-height: 1.6;
  color: #909399;
}

.photo-preview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.detail-photo {
  width: 100%;
  height: 120px;
  border-radius: 8px;
  border: 1px solid #ebeef5;
  background: #f5f7fa;
}

.file-link-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.file-link-item {
  max-width: 100%;
}

.insight-card {
  margin-bottom: 16px;
}

.insight-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.insight-item {
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #f8fafc;
}

.insight-label {
  margin-bottom: 8px;
  font-size: 12px;
  color: #909399;
}

.insight-value {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  line-height: 1.5;
}

.insight-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.action-card {
  margin-bottom: 16px;
}

.action-card-header {
  font-size: 15px;
  font-weight: 600;
}

.action-form {
  max-width: 760px;
}

:deep(.el-table) { font-size: 14px; }
:deep(.el-table th) { font-size: 14px; font-weight: bold; }
:deep(.el-table td) { padding: 10px 0; }
</style>
