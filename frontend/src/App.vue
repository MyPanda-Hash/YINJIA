<template>
  <el-config-provider :locale="localeStore.epLocale">
    <router-view />
  </el-config-provider>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useLocaleStore } from '@/stores/locale'

const localeStore = useLocaleStore()

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
