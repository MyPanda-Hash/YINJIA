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

    <template v-else-if="isSupplier">
      <!-- 供应商门户(2026-10-24):供应商账号**只有「供应商采购打印」一页**(用户口径「没有别的权限」)。
           故不给侧栏/页签/我的桌面入口,只留一条极简顶栏(供应商身份 + 改密 + 退出) ——
           少一个可点的入口,就少一次"点进去吃 403"的困惑。 -->
      <div class="portal-supplier-bar">
        <span class="psb-brand">YINJIA-MES</span>
        <el-tag size="small" type="warning" class="psb-tag">{{ tt('供应商采购打印') }}</el-tag>
        <span class="psb-supplier">{{ supplierLabel }}</span>
        <span class="psb-spacer"></span>
        <el-dropdown trigger="click" @command="onSupplierCommand">
          <span class="psb-user">
            <el-icon><User /></el-icon>
            {{ user.realName || user.account || tt('供应商') }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="account">{{ tt('账号信息') }}</el-dropdown-item>
              <el-dropdown-item command="password">{{ tt('修改密码') }}</el-dropdown-item>
              <el-dropdown-item command="logout" divided>{{ tt('退出登录') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <div class="portal-body">
        <div class="portal-main">
          <div class="portal-content">
            <router-view v-slot="{ Component }">
              <component :is="Component" :key="route.path" />
            </router-view>
          </div>
        </div>
      </div>
      <component :is="AccountDialog" v-model="accountVisible" />
      <component :is="ChangePwdDialog" v-model="pwdVisible" />
    </template>

    <template v-else>
    <!-- ⚠ 这一行是内部账号(含管理员)的**整条顶栏**(银嘉数字化平台/账本/搜索/公告/通知/系统管理员/用户下拉)。
         2026-10-24 加供应商门户分支时被误删过一行 ⇒ 所有人顶栏消失(截图可见工作区从侧栏开始)。
         改本文件的分支结构时,务必先确认内部账号那支里 TopBar / LeftNav / TabsBar / HelpPanel 四件套齐全。 -->
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
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useRoute } from 'vue-router'
import TopBar from './TopBar.vue'
import LeftNav from './LeftNav.vue'
import TabsBar from './TabsBar.vue'
import HelpPanel from './HelpPanel.vue'
import { User, ArrowDown } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { useTabsStore } from '@/stores/tabs'
import { findMenuByPath } from '@/business/menus'
import { tt } from '@/i18n'

const app = useAppStore()
const user = useUserStore()
const tabs = useTabsStore()
const route = useRoute()
const router = useRouter()

/**
 * 供应商会话(2026-10-24):后端在登录/会话还原时下发 supplierCode —— 该账号**只有**供应商采购打印一页。
 * 此时整个桌面壳(顶栏/侧栏/页签)都不渲染,只留一条极简条 + 内容区。
 */
const isSupplier = computed(() => !!user.supplierCode)
const supplierLabel = computed(() => {
  const code = user.supplierCode || ''
  const name = user.supplierName || ''
  if (code && name && name !== code) return `${name}(${code})`
  return name || code
})

/**
 * 供应商顶栏上的两个弹窗**按需加载**(defineAsyncComponent):内部账号一个字节都不必加载,
 * 供应商会话里也不进主包首屏。仓库里没有语言切换组件 ⇒ 不登记(顶栏就不显示语言切换,
 * 供应商要换语言走登录页那个切换器,或浏览器默认语言)。
 */
const AccountDialog = defineAsyncComponent({
  loader: () => import('@/layout/AccountDialog.vue'),
  suspensible: false,
})
const ChangePwdDialog = defineAsyncComponent({
  loader: () => import('@/layout/ChangePwdDialog.vue'),
  suspensible: false,
})
const accountVisible = ref(false)
const pwdVisible = ref(false)

function onSupplierCommand(cmd) {
  if (cmd === 'logout') {
    user.logout()
    router.replace('/login')
    return
  }
  if (cmd === 'account') accountVisible.value = true
  if (cmd === 'password') pwdVisible.value = true
}

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
  /* 顶部安全区(2026-10-21):手机挖孔屏/刘海屏的状态栏、摄像头会盖住 TopBar,
     导致「顶部被卡住、按钮点不动」。inset-top 在挖孔屏上约 24~48px,桌面恒为 0。
     用 padding 而不是 margin:整块布局仍在视口内,不会多出滚动条。
     前提是 index.html 的 viewport 带 viewport-fit=cover,否则 env() 恒为 0。 */
  /* --yj-safe-top = 开发期桌面预览的覆盖层(DevTools 设备模拟不实现 env(),安全区恒为 0),
     开法见 main.js 顶部的 ?safeTop=44;生产环境没人设这个变量 ⇒ 仍然只用 env()。 */
  padding-top: var(--yj-safe-top, env(safe-area-inset-top, 0px));
  box-sizing: border-box;
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

/* 供应商门户顶栏(2026-10-24):供应商账号只有一页,故只留一条极简条 */
.portal-supplier-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 48px;
  padding: 0 16px;
  box-sizing: border-box;
  background: #fff;
  border-bottom: 1px solid #e3e8ef;
  flex: none;
}
.psb-brand { font-weight: 700; color: #1c4f8a; letter-spacing: 0.5px; }
.psb-supplier { font-size: 13px; color: #606266; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.psb-spacer { flex: 1; }
.psb-user {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
}
.psb-user:hover { background: #f2f6fc; }

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
