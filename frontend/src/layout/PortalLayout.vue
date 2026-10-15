<template>
  <div class="portal" :class="{ dark: app.dark }">
    <TopBar />
    <div class="portal-body">
      <LeftNav v-if="!app.maxContent" />
      <div class="portal-main">
        <TabsBar />
        <div class="portal-content">
          <router-view v-slot="{ Component }">
            <keep-alive :max="20">
              <!-- ⚠ `:key="route.path"`(2026-10-16 用户口径「切换 tab 页…填写的表格数据要保留」):
                   不同面板列表页**(同一个 PanelxList 组件)**原先共用一个 keep-alive 缓存条目 ——
                   切页签回来时复用同一实例、路由参数一变就重新 load,没保存的填写内容当场没了。
                   按页签路径给 key ⇒ 每个页签一份实例与状态(未保存内容、当前单据、页签内滚动位置),
                   页签关掉这个 key 也随之释放。键用 path(不是 fullPath):同一页签内换单据走 ?code=,
                   仍是同一个页签、同一份实例(单据内切换由面板自己的守卫处理)。 -->
              <component :is="Component" :key="route.path" />
            </keep-alive>
          </router-view>
        </div>
      </div>
    </div>

    <!-- 移动端：抽屉遮罩 -->
    <transition name="fade">
      <div v-if="app.mobileNav" class="nav-mask" @click="app.toggleMobileNav()"></div>
    </transition>

    <!-- T+ 浮层：右侧帮助面板 -->
    <HelpPanel />
  </div>
</template>

<script setup>
import { onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import TopBar from './TopBar.vue'
import LeftNav from './LeftNav.vue'
import TabsBar from './TabsBar.vue'
import HelpPanel from './HelpPanel.vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import { findMenuByPath } from '@/business/menus'

const app = useAppStore()
const user = useUserStore()
const tabs = useTabsStore()
const route = useRoute()

onMounted(() => {
  if (app.dark) document.documentElement.classList.add('dark')
  // 已离开登录页:清除深色底色标记(供 index.html 预置底色判断)
  try { sessionStorage.removeItem('mes_at_login') } catch { /* ignore */ }
  document.documentElement.classList.remove('login-bg')
  // Login data is cached for fast startup; refresh it so server-side corrections
  // and permission changes replace stale localStorage values on the next load.
  Promise.allSettled([user.fetchUserInfo(), user.fetchFactories()])
})

watch(
  () => route.path,
  (p) => {
    tabs.setActive(p)
    const menu = findMenuByPath(p)
    if (menu && !tabs.tabs.find((t) => t.path === p)) tabs.open(menu)
  },
  { immediate: true }
)
</script>

<style scoped>
.portal {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.portal-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.portal-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.portal-content {
  flex: 1;
  overflow: auto;
  background: var(--t-content-bg);
  padding: 16px;
}

/* 移动端：抽屉遮罩 */
.nav-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 900;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .portal-content {
    padding: 10px;
  }
}
</style>
