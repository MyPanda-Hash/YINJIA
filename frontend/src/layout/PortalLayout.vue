<template>
  <div class="portal" :class="{ dark: app.dark }">
    <!-- 窄屏沉浸页(2026-10-20):路由带 meta.immersiveOnMobile 且屏幕窄时,**不套桌面壳**
         (顶栏/页签/侧栏一律不渲染),只出一块内容区 —— 这样「同一个地址」在手机上是全屏作业页,
         又不用维护第二套路由/第二份组件。规范依据:docs/design/补充设计-V2.0.md §4.4
         「移动端 H5 不套完整桌面布局」;桌面宽度下仍是正常壳层。 -->
    <template v-if="immersive">
      <div class="portal-immersive">
        <router-view v-slot="{ Component }">
          <component :is="Component" :key="route.path" />
        </router-view>
      </div>
    </template>

    <template v-else>
    <TopBar />
    <div class="portal-body">
      <LeftNav v-if="!app.maxContent" />
      <div class="portal-main">
        <TabsBar />
        <div class="portal-content">
          <router-view v-slot="{ Component }">
            <!-- ⚠ `:key="route.path"`(2026-10-16 用户口径「切换 tab 页…填写的表格数据要保留」):
                 不同面板列表页**(同一个 PanelxList 组件)**原先共用一个 keep-alive 缓存条目 ——
                 切页签回来时复用同一实例、路由参数一变就重新 load,没保存的填写内容当场没了。
                 按页签路径给 key ⇒ 每个页签一份实例与状态(未保存内容、当前单据、页签内滚动位置),
                 页签关掉这个 key 也随之释放。键用 path(不是 fullPath):同一页签内换单据走 ?code=,
                 仍是同一个页签、同一份实例(单据内切换由面板自己的守卫处理)。
                 ⚠ **这段注释必须在 <keep-alive> 外面**:dev 模式的编译器要求 keep-alive
                 **恰好一个子元素**(compiler-core postTransformElement:`node.children.length > 1`
                 即报错 X_KEEP_ALIVE_INVALID_CHILDREN),而注释也算一个 child ——
                 放进里面会把整页顶成 vite 错误遮罩(生产构建只警告,所以构建期看不出来)。 -->
            <keep-alive :max="20">
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
    </template>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

// 窄屏沉浸页(2026-10-20):断点 768,与 LeftNav/PortalLayout 自己的手机菜单断点一致。
// 只有路由声明了 meta.immersiveOnMobile 的页面才享受(目前只有「生产领料」)。
const narrow = ref(false)
let mq = null
const onMq = (e) => { narrow.value = e.matches }
const immersive = computed(() => !!route.meta.immersiveOnMobile && narrow.value)
onBeforeUnmount(() => { if (mq) mq.removeEventListener('change', onMq) })

onMounted(() => {
  if (app.dark) document.documentElement.classList.add('dark')
  // 已离开登录页:清除深色底色标记(供 index.html 预置底色判断)
  try { sessionStorage.removeItem('mes_at_login') } catch { /* ignore */ }
  document.documentElement.classList.remove('login-bg')
  // 窄屏判定(沉浸页用):768px 与 LeftNav/本文件手机菜单断点保持一致
  if (typeof window !== 'undefined' && window.matchMedia) {
    mq = window.matchMedia('(max-width: 767px)')
    narrow.value = mq.matches
    mq.addEventListener('change', onMq)
  }
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
