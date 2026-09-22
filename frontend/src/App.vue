<template>
  <el-config-provider :locale="localeStore.epLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { provideGlobalConfig } from 'element-plus'
import { useLocaleStore } from '@/stores/locale'

const localeStore = useLocaleStore()

/**
 * Element Plus 的**命令式**组件(ElMessageBox / ElMessage / ElNotification)渲染在组件树之外,
 * 拿不到模板里 <el-config-provider> 的 locale —— 它们只认模块级的 globalConfig,
 * 而 main.js 的 app.use(ElementPlus) 没传 options,安装器就没调用 provideGlobalConfig,
 * 于是它们永远停在 Element Plus 的默认语言(中文):英文界面下弹窗按钮仍是「确定 / 取消」。
 *
 * 这里把当前语言同步进**全局**配置(第三参 global=true),命令式组件才能跟着切;
 * 模板内组件继续走 <el-config-provider>(本就正确)。切语言 → watch 重设全局快照。
 * 依据:element-plus/es/components/config-provider/src/hooks/use-global-config.mjs
 * (globalConfig 是模块级 ref;global=true 时才写入,命令式组件回退读它)。
 */
watch(
  () => localeStore.epLocale,
  (locale) => provideGlobalConfig({ locale }, undefined, true),
  { immediate: true },
)

// Alt+L 循环切换语言(决策 2026-08-30:像输入法一样的快捷切换)。
// 输入框聚焦时跳过,避免干扰打字。
const onKeydown = (e) => {
  if (!e.altKey || (e.key !== 'l' && e.key !== 'L')) return
  const active = document.activeElement
  const tag = active ? active.tagName : ''
  if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return
  if ((localeStore.available?.length || 2) < 2) return
  e.preventDefault()
  localeStore.cycle()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>
