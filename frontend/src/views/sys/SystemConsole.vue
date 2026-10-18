<!-- SystemConsole.vue — 系统管理平台(2026-10-18 改版) -->
<!-- 一级目录「系统管理平台」从原来的 32 张面板降级为这一页系统功能入口:
     账号信息 / 修改密码 / 显示设置 / 管理员专属(组织架构、使用权限查看)。
     那 32 张基础资料面板已整体迁入「数据建模」——本页不再承载面板列表。 -->
<template>
  <div class="sys-wrap">
    <div class="sys-col">
      <section class="sys-card">
        <div class="card-head">
          <span class="card-title">{{ tt('账号信息') }}</span>
          <el-button link type="primary" size="small" @click="loadMe">{{ tt('刷新') }}</el-button>
        </div>
        <el-descriptions :column="1" border size="small" class="acc-desc">
          <el-descriptions-item :label="tt('账号')">{{ user.account || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="tt('姓名')">{{ user.realName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="tt('当前工厂')">{{ user.factoryName || '-' }}</el-descriptions-item>
          <el-descriptions-item :label="tt('角色')">{{ roleText }}</el-descriptions-item>
          <el-descriptions-item :label="tt('服务到期')">{{ user.serviceEnd || '-' }}</el-descriptions-item>
        </el-descriptions>
      </section>

      <section class="sys-card">
        <div class="card-head">
          <span class="card-title">{{ tt('修改密码') }}</span>
        </div>
        <el-form :model="pwdForm" label-width="90px" class="pwd-form" @submit.prevent>
          <el-form-item :label="tt('原密码')">
            <el-input v-model="pwdForm.old" type="password" show-password :placeholder="tt('请输入原密码')" />
          </el-form-item>
          <el-form-item :label="tt('新密码')">
            <el-input v-model="pwdForm.next" type="password" show-password :placeholder="tt('至少 6 位')" />
          </el-form-item>
          <el-form-item :label="tt('确认密码')">
            <el-input v-model="pwdForm.confirm" type="password" show-password :placeholder="tt('再次输入新密码')" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="pwdLoading" @click="changePwd">{{ tt('确定') }}</el-button>
          </el-form-item>
        </el-form>
        <div class="card-tip">{{ tt('改密后请用新密码重新登录。') }}</div>
      </section>
    </div>

    <div class="sys-col">
      <section class="sys-card">
        <div class="card-head">
          <span class="card-title">{{ tt('显示设置') }}</span>
        </div>
        <div class="set-row">
          <span class="set-label">{{ tt('暗色模式') }}</span>
          <el-switch :model-value="app.dark" @change="app.toggleDark()" />
        </div>
        <div class="set-row">
          <span class="set-label">{{ tt('界面设置') }}</span>
          <el-button size="small" @click="uiSettingVisible = true">{{ tt('打开') }}</el-button>
        </div>
        <div class="set-row">
          <span class="set-label">{{ tt('工作台设置') }}</span>
          <el-button size="small" @click="deskSettingVisible = true">{{ tt('打开') }}</el-button>
        </div>
        <div class="card-tip">{{ tt('设置实时生效并保存到本机浏览器。') }}</div>
      </section>

      <section v-if="user.isAdmin" class="sys-card">
        <div class="card-head">
          <span class="card-title">{{ tt('管理员功能') }}</span>
        </div>
        <div class="entry-row">
          <el-button size="small" @click="go('/sys/org')">{{ tt('组织架构') }}</el-button>
          <el-button size="small" @click="go('/sys/usage')">{{ tt('使用权限查看') }}</el-button>
        </div>
        <div class="card-tip">{{ tt('部门/账号/角色与面板权限；全公司使用留痕。') }}</div>
      </section>
    </div>

    <UiSettingsDialog v-model="uiSettingVisible" />
    <DeskSettingsDialog v-model="deskSettingVisible" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { apiChangePassword } from '@/business/api'
import { tt } from '@/i18n'
import UiSettingsDialog from '@/layout/UiSettingsDialog.vue'
import DeskSettingsDialog from '@/layout/DeskSettingsDialog.vue'

const router = useRouter()
const user = useUserStore()
const app = useAppStore()

const uiSettingVisible = ref(false)
const deskSettingVisible = ref(false)

const roleText = computed(() => {
  const roles = user.userInfo?.roles || []
  return roles.length ? tt(roles.join('、')) : tt('未分配')
})

const pwdForm = ref({ old: '', next: '', confirm: '' })
const pwdLoading = ref(false)

async function changePwd() {
  const f = pwdForm.value
  if (!f.old || !f.next || !f.confirm) return ElMessage.warning(tt('请填写完整'))
  if (f.next.length < 6) return ElMessage.warning(tt('新密码至少 6 位'))
  if (f.next !== f.confirm) return ElMessage.warning(tt('两次输入的新密码不一致'))
  pwdLoading.value = true
  try {
    await apiChangePassword({ old: f.old, next: f.next })
    pwdForm.value = { old: '', next: '', confirm: '' }
    ElMessage.success(tt('密码修改成功，请用新密码重新登录'))
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('修改密码失败'))
  } finally {
    pwdLoading.value = false
  }
}

async function loadMe() {
  try {
    await user.fetchUserInfo()
    await user.fetchPerms()
    ElMessage.success(tt('已刷新'))
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('刷新失败'))
  }
}

function go(path) {
  router.push(path)
}

onMounted(() => {
  // 本页只展示已登录账号自身信息,不额外请求;「刷新」按钮才重拉 user/fetchPerms。
})
</script>

<style scoped>
.sys-wrap {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  padding: 14px;
  box-sizing: border-box;
  align-items: start;
  max-width: 1180px;
}
.sys-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.sys-card {
  background: #fff;
  border: 1px solid #e3e8ef;
  border-radius: 6px;
  padding: 12px;
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.card-title { font-size: 14px; font-weight: 600; color: #1c4f8a; }
.card-tip { margin-top: 8px; font-size: 12px; color: #999; line-height: 1.6; }
.acc-desc :deep(.el-descriptions__label) { width: 96px; color: #6b7280; }
.pwd-form { max-width: 420px; }
.set-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
  border-bottom: 1px dashed #f0f2f5;
}
.set-row:last-of-type { border-bottom: none; }
.set-label { font-size: 13px; color: #303133; }
.entry-row { display: flex; gap: 8px; flex-wrap: wrap; }

@media (max-width: 900px) {
  .sys-wrap { grid-template-columns: minmax(0, 1fr); }
}
</style>
