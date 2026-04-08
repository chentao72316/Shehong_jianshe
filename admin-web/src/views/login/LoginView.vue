<template>
  <div class="login-page">
    <div class="login-split">
      <!-- 左侧品牌区 -->
      <div class="brand-panel">
        <div class="brand-inner">
          <div class="brand-logo">
            <div class="brand-icon">建</div>
          </div>
          <h1 class="brand-title">射洪建设支撑</h1>
          <p class="brand-desc">有线宽带建设工单管理系统</p>
          <div class="brand-features">
            <div class="feature-item">
              <span class="feature-dot"></span>工单全流程跟踪管理
            </div>
            <div class="feature-item">
              <span class="feature-dot"></span>多区县数据隔离
            </div>
            <div class="feature-item">
              <span class="feature-dot"></span>超时智能督办
            </div>
            <div class="feature-item">
              <span class="feature-dot"></span>实时统计报表
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录区 -->
      <div class="form-panel">
        <div class="form-inner">
          <div class="form-header">
            <h2 class="form-title">欢迎回来</h2>
            <p class="form-sub">请登录您的管理员账号</p>
          </div>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="login-form"
          >
            <el-form-item label="手机号" prop="phone">
              <el-input
                v-model="form.phone"
                placeholder="请输入手机号"
                maxlength="11"
                size="large"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="form.password"
                type="password"
                placeholder="请输入密码"
                show-password
                size="large"
                @keyup.enter="handleLogin"
              />
            </el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              size="large"
              class="login-btn"
              @click="handleLogin"
            >
              {{ loading ? '登录中…' : '登 录' }}
            </el-button>
          </el-form>

          <p class="form-footer">遂宁市有线宽带建设管理平台</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { phonePasswordLogin } from '@/api/auth'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()

const formRef = ref<FormInstance>()
const loading = ref(false)

const form = reactive({ phone: '', password: '' })

const rules: FormRules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const data = await phonePasswordLogin(form.phone, form.password)
      userStore.setUser(data.userInfo, data.token)
      ElMessage.success('登录成功')
      router.push('/dashboard')
    } catch (error: any) {
      console.error(error)
    } finally {
      loading.value = false
    }
  })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  background: var(--color-bg);
}

.login-split {
  display: flex;
  width: 100%;
}

/* ── Brand Panel (left) ───────────────────────────────────── */
.brand-panel {
  width: 45%;
  background: var(--color-sidebar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
  position: relative;
  overflow: hidden;
}

.brand-panel::before {
  content: '';
  position: absolute;
  top: -120px;
  right: -80px;
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(29, 78, 216, 0.25) 0%, transparent 70%);
}

.brand-panel::after {
  content: '';
  position: absolute;
  bottom: -80px;
  left: -60px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(29, 78, 216, 0.15) 0%, transparent 70%);
}

.brand-inner {
  position: relative;
  z-index: 1;
  max-width: 320px;
}

.brand-logo {
  margin-bottom: 24px;
}

.brand-icon {
  width: 56px;
  height: 56px;
  background: var(--color-accent);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 26px;
  font-weight: 800;
  box-shadow: 0 8px 24px rgba(29, 78, 216, 0.4);
}

.brand-title {
  color: #ffffff;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
  line-height: 1.2;
}

.brand-desc {
  color: #64748b;
  font-size: 14px;
  margin-bottom: 40px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  font-size: 13.5px;
}

.feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #3b82f6;
  flex-shrink: 0;
}

/* ── Form Panel (right) ───────────────────────────────────── */
.form-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 48px;
}

.form-inner {
  width: 100%;
  max-width: 380px;
}

.form-header {
  margin-bottom: 36px;
}

.form-title {
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin-bottom: 6px;
}

.form-sub {
  color: var(--color-text-muted);
  font-size: 14px;
}

/* Override form label */
.login-form :deep(.el-form-item__label) {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-secondary) !important;
  padding-bottom: 6px;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 8px !important;
  padding: 0 14px;
}

.login-form :deep(.el-input--large .el-input__inner) {
  height: 44px;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  height: 46px;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px !important;
  letter-spacing: 0.05em;
  margin-top: 8px;
  background: var(--color-accent) !important;
  border-color: var(--color-accent) !important;
  box-shadow: 0 4px 14px rgba(29, 78, 216, 0.35);
  transition: box-shadow 0.2s, transform 0.1s;
}

.login-btn:hover {
  box-shadow: 0 6px 20px rgba(29, 78, 216, 0.45) !important;
  transform: translateY(-1px);
}

.login-btn:active {
  transform: translateY(0);
}

.form-footer {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
  margin-top: 32px;
}

/* Responsive: stack on narrow screens */
@media (max-width: 768px) {
  .login-split {
    flex-direction: column;
  }
  .brand-panel {
    width: 100%;
    padding: 40px 32px;
    min-height: 220px;
  }
  .form-panel {
    padding: 40px 32px;
  }
}
</style>
