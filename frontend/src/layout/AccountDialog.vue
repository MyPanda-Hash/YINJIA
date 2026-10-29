<!-- AccountDialog.vue — 账号信息弹窗(供应商门户顶栏用,2026-10-24) -->
<!-- 为什么单独抽一份:供应商会话不进 TopBar(桌面壳整体不渲染,见 PortalLayout),
     但"我是谁/绑的是哪个供应商"这层自我核对对供应商很重要 —— 让他在页面上确认
     「看到的确实是本公司的订单」。内容与 TopBar「账号管理」同源(user store),不加任何新字段。
     供应商会话里 roles = ['供应商']、factory = 登录时选的账套,均由后端下发。 -->
<template>
  <el-dialog :model-value="modelValue" :title="tt('账号信息')" width="440px" append-to-body
    @update:model-value="(v) => emit('update:modelValue', v)">
    <el-descriptions :column="1" border size="small">
      <el-descriptions-item :label="tt('账号')">{{ user.account }}</el-descriptions-item>
      <el-descriptions-item :label="tt('供应商')">{{ supplierText }}</el-descriptions-item>
      <el-descriptions-item :label="tt('当前工厂')">{{ user.factoryName || '-' }}</el-descriptions-item>
      <el-descriptions-item :label="tt('角色')">{{ tt((user.userInfo?.roles || []).join('、')) || tt('未分配') }}</el-descriptions-item>
    </el-descriptions>
    <div class="ac-tip">{{ tt('本账号仅可使用「供应商采购打印」:只能查看和打印本公司名下的采购订单。') }}</div>
  </el-dialog>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'
import { tt } from '@/i18n'

defineProps({ modelValue: { type: Boolean, default: false } })
const emit = defineEmits(['update:modelValue'])
const user = useUserStore()

const supplierText = computed(() => {
  const code = user.supplierCode || ''
  const name = user.supplierName || ''
  if (code && name && name !== code) return `${name}(${code})`
  return name || code || '-'
})
</script>

<style scoped>
.ac-tip { margin-top: 10px; font-size: 12px; color: #909399; line-height: 1.6; }
</style>
