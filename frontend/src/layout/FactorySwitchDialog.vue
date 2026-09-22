<template>
  <!-- 账套(工厂)切换:ADR-0003 一系统两账套,账套绑在登录令牌里 ⇒ 切换 = 用目标账套的密码重登。
       为什么不是"点一下直接切":数据源由 JWT 声明路由(JwtAuthFilter),不重登就换不掉库;
       而不验密重签令牌等于让测试库里的账号能直接进正式账套看真实数据(越权)。 -->
  <el-dialog
    :model-value="modelValue"
    :title="tt('切换账套')"
    width="440px"
    append-to-body
    class="factory-switch-dialog"
    @update:model-value="(v) => $emit('update:modelValue', v)"
    @closed="reset"
  >
    <div class="fs-body">
      <div class="fs-pair">
        <div class="fs-cell">
          <span class="fs-label">{{ tt('当前账套') }}</span>
          <b class="fs-name">{{ currentName }}</b>
        </div>
        <el-icon class="fs-arrow"><Right /></el-icon>
        <div class="fs-cell">
          <span class="fs-label">{{ tt('切换到') }}</span>
          <b class="fs-name target">{{ targetName }}</b>
        </div>
      </div>

      <el-input
        ref="pwdRef"
        v-model="password"
        type="password"
        show-password
        :placeholder="tt('请输入该账套的登录密码')"
        :disabled="loading"
        @keyup.enter="submit"
      />

      <div class="fs-hint">
        {{ tt('账套绑定在登录令牌上，切换需要用目标账套的密码重新登录；成功后页面会刷新，菜单与数据全部按新账套重建。') }}
      </div>
      <div v-if="error" class="fs-error">{{ error }}</div>
    </div>

    <template #footer>
      <el-button :disabled="loading" @click="$emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="loading" @click="submit">{{ tt('切换并重新登录') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Right } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

const props = defineProps({
  modelValue: Boolean,
  target: { type: Object, default: null },
})
defineEmits(['update:modelValue'])

const user = useUserStore()
const password = ref('')
const loading = ref(false)
const error = ref('')
const pwdRef = ref(null)

const currentName = computed(() => user.factoryName || tt('未知账套'))
const targetName = computed(() => (props.target && props.target.name) || tt('未知账套'))

watch(() => props.modelValue, async (open) => {
  if (!open) return
  error.value = ''
  password.value = ''
  await nextTick()
  // 弹窗只为一件事而开:输密码。别让用户再点一次输入框
  pwdRef.value && pwdRef.value.focus && pwdRef.value.focus()
})

function reset() {
  password.value = ''
  error.value = ''
  loading.value = false
}

async function submit() {
  if (loading.value) return
  if (!password.value) {
    error.value = tt('请输入密码')
    return
  }
  if (!props.target || !props.target.code) {
    error.value = tt('未选择账套')
    return
  }
  loading.value = true
  error.value = ''
  try {
    await user.switchFactory(props.target, password.value)
    ElMessage.success(tt('已切换账套，正在重新加载') + ' ' + targetName.value)
    // 整页重建:菜单/面板/权限/桌面数据全部按新令牌(新库)重新拉取
    setTimeout(() => window.location.reload(), 400)
  } catch (e) {
    // 与登录页同一套取错方式:后端把原因放在 ApiResult.message(如"用户名或密码错误"),
    // 直接用 e.message 会显示成 "Request failed with status code 409"
    error.value = (e && e.response && e.response.data && e.response.data.message)
      || (e && e.message)
      || tt('切换失败，请检查密码后重试')
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fs-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fs-pair {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--t-border-light);
  border-radius: 8px;
  background: var(--t-sidebar-bg);
}
.fs-cell {
  min-width: 0;
  flex: 1;
}
.fs-label {
  display: block;
  font-size: 12px;
  color: var(--t-text-3);
}
.fs-name {
  display: block;
  margin-top: 2px;
  overflow: hidden;
  font-size: 13px;
  color: var(--t-text-1);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fs-name.target {
  color: var(--t-primary);
}
.fs-arrow {
  flex: none;
  color: var(--t-text-3);
}
.fs-hint {
  font-size: 12px;
  line-height: 1.6;
  color: var(--t-text-3);
}
.fs-error {
  padding: 6px 10px;
  border: 1px solid rgba(185, 77, 63, 0.28);
  border-radius: 6px;
  background: rgba(185, 77, 63, 0.08);
  color: #b94d3f;
  font-size: 12px;
}
</style>
