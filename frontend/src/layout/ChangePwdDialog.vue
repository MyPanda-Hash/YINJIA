<!-- ChangePwdDialog.vue — 修改密码弹窗(供应商门户顶栏用,2026-10-24) -->
<!-- 与 TopBar 里那份**逐条同一口径**(调同一个 /auth/changePassword、同样改完即作废当前会话):
     抽出来只为供应商会话能改密 —— 供应商账号密码就该由供应商自己保管,
     否则每次重置都得麻烦采购部进「供应商权限配置」代设。
     真正的规则在服务端 AuthController.changePassword(原密码校验/至少 6 位/新旧不同)。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('修改密码')" width="420px" append-to-body
    @update:model-value="(v) => emit('update:modelValue', v)">
    <el-form :model="form" label-width="80px" @submit.prevent>
      <el-form-item :label="tt('原密码')">
        <el-input v-model="form.old" type="password" show-password :placeholder="tt('请输入原密码')" />
      </el-form-item>
      <el-form-item :label="tt('新密码')">
        <el-input v-model="form.next" type="password" show-password :placeholder="tt('至少 6 位')" />
      </el-form-item>
      <el-form-item :label="tt('确认密码')">
        <el-input v-model="form.confirm" type="password" show-password :placeholder="tt('再次输入新密码')" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">{{ tt('取消') }}</el-button>
      <el-button type="primary" :loading="loading" @click="submit">{{ tt('确定') }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { apiChangePassword } from '@/business/api'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
const router = useRouter()
const user = useUserStore()
const loading = ref(false)
const form = ref({ old: '', next: '', confirm: '' })

async function submit() {
  const f = form.value
  if (!f.old || !f.next || !f.confirm) return ElMessage.warning(tt('请填写完整'))
  if (f.next.length < 6) return ElMessage.warning(tt('新密码至少 6 位'))
  if (f.next !== f.confirm) return ElMessage.warning(tt('两次输入的新密码不一致'))
  loading.value = true
  try {
    await apiChangePassword({ old: f.old, next: f.next })
    emit('update:modelValue', false)
    form.value = { old: '', next: '', confirm: '' }
    // 改密即作废当前会话(与 TopBar 一致):令牌里没有密码版本号,旧 token 不会因改密失效
    ElMessage.success(tt('密码修改成功，请用新密码重新登录'))
    user.logout()
    router.replace('/login')
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || tt('修改密码失败'))
  } finally {
    loading.value = false
  }
}
</script>
