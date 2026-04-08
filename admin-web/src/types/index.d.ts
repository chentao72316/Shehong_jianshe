// 角色枚举
export type Role = 'FRONTLINE' | 'DISTRICT_MANAGER' | 'DEPT_MANAGER' | 'LEVEL4_MANAGER' | 'DESIGN' | 'CONSTRUCTION' | 'SUPERVISOR' | 'ADMIN' | 'GRID_MANAGER' | 'NETWORK_MANAGER'

// 用户信息
export interface UserInfo {
  id: string
  name: string
  phone: string
  roles: Role[]
  district?: string
  area: string
  gridName: string
  feishuId?: string
  wxAccount?: string
  employeeId?: string
  staffType?: string
  active?: boolean
  passwordChanged?: boolean
}

// 登录响应
export interface LoginResponse {
  token: string
  userInfo: UserInfo
}

// 管理员总览统计
export interface AdminOverview {
  total: number
  pending: number
  inProgress: number
  completed: number
  timeout: number
  userCount: number
}

// 需求状态
export type DemandStatus = '待审核' | '待指派' | '设计中' | '设计中（超时）' | '待施工' | '施工中' | '施工中（超时）' | '待监理验收' | '监理验收中' | '待确认' | '整体超时' | '已开通' | '已驳回'

// 需求类型
export type DemandType = '新建' | '扩容' | '改造' | '应急'

// 业务类型
export type BusinessType = '家宽' | '专线' | '无线' | '其他'

// 紧急程度
export type Urgency = '普通' | '紧急' | '特急'

// 需求信息
export interface Demand {
  id: string
  demandNo: string
  acceptArea: string
  gridName?: string
  type: DemandType
  businessType?: BusinessType
  status: DemandStatus
  urgency: Urgency
  demandPersonName: string
  demandPersonPhone: string
  submitterPhone?: string
  reservedCustomers?: number
  locationDetail?: string
  latitude?: number
  longitude?: number
  serviceCenter?: string
  networkSupport?: string
  assignedDesignUnit?: { name: string; phone: string } | string
  assignedConstructionUnit?: { name: string; phone: string } | string
  assignedSupervisor?: { name: string; phone: string } | string
  createdBy?: { name: string; phone: string } | string
  crossAreaReviewerId?: { name: string; phone: string } | string
  designAssignTime?: string
  constructionAssignTime?: string
  completedTime?: string
  createdAt?: string
  logs?: DemandLog[]
  rejectionReason?: string
  rejectCount?: number
  remark?: string
}

export interface DemandLog {
  time?: string
  createdAt?: string
  operator?: string
  operatorName?: string
  action?: string
  content?: string
  detail?: string
}

// 超时需求
export interface TimeoutDemand extends Demand {
  timeoutDays: number
  timeoutType: '设计超时' | '施工超时' | '整体超时'
}

// 人员配置
export interface StaffMember {
  id: string
  name: string
  phone: string
  roles: Role[]
  district?: string
  area: string
  gridName: string
  feishuId?: string
  wxAccount?: string
  employeeId?: string
  staffType?: string
  active: boolean
  passwordChanged?: boolean
  createdAt?: string
}

// 区域统计
export interface AreaStats {
  area: string
  total: number
  completed: number
  inProgress: number
  timeout: number
  completionRate: number
}

// 网格统计
export interface GridStats {
  gridName: string
  area: string
  total: number
  completed: number
  timeout: number
  completionRate: number
}

// 分页响应
export interface PaginatedResponse<T> {
  total: number
  list: T[]
}

// API 响应格式
export interface ApiResponse<T = any> {
  code: number
  data?: T
  message?: string
}

// 受理区域配置
export interface CandidateUser {
  _id: string
  name: string
  phone: string
}

export interface AreaConfig {
  _id: string
  district: string
  acceptArea: string
  networkCenter: string
  designCandidates: CandidateUser[]
  constructionCandidates: CandidateUser[]
  supervisorCandidates: CandidateUser[]
  networkManagerId: CandidateUser | null
  active: boolean
  createdAt?: string
  updatedAt?: string
}

// 角色权限配置
export type VisibilityScope = 'all' | 'area' | 'grid' | 'self' | 'assigned'

export interface RoleConfig {
  _id: string
  role: string
  label: string
  visibilityScope: VisibilityScope
  description: string
}
