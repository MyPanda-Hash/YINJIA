import { createApp } from 'vue'
import { createPinia } from 'pinia'
// Element Plus 按需引入(2026-09-28 性能优化,原先全量 app.use(ElementPlus)+全量 CSS 主包 2.5MB):
// 模板组件由 vite Components 插件自动注册并按组件带样式;这里只补 resolver 覆盖不到的部分——
// ① v-loading 指令(全库 24 处使用) ② 命令式 JS API 的样式(ElMessage/ElMessageBox/ElNotification)。
import { ElLoading } from 'element-plus'
import 'element-plus/es/components/loading/style/css'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'
import 'element-plus/es/components/notification/style/css'
import 'element-plus/es/components/dialog/style/css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles/index.css'
import * as sqlPanelRuntime from './business/engine'
import { installAppContext, installPanelRuntime } from './core/panel-runtime'
import { i18n, registerDictFetcher, ensureLocalePack } from './i18n'
import { useLocaleStore } from './stores/locale'
import { useTabsStore } from './stores/tabs'
import { useUserStore } from './stores/user'

const app = createApp(App)

installPanelRuntime(sqlPanelRuntime)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(ElLoading)

// core 视图不认 pinia(分层约束:core 只依赖注入进来的东西),所以把应用外壳状态
// (账号/页签/语言)显式注入;必须在 createPinia() 之后,store 实例才可用。
installAppContext({ user: useUserStore(), tabs: useTabsStore(), locale: useLocaleStore() })

// 应用启动时把检测到的 locale 应用到 i18n 与 <html lang>;
// 拉取动态语言列表(yj_locale 注册表);外语缺失词典(翻译表/机翻)后台补齐
// (静态包词条挂载即生效,机翻补缺的零星词条下次刷新生效——翻译表已缓存)。
const localeStore = useLocaleStore()
// 语言包按需加载:启动 locale 可能来自 localStorage/浏览器探测(非中文),
// 先取包再挂载,首屏无中文闪烁(zh-CN 恒驻零开销;动态语言无包时空手而归走机翻)。
// 注:async IIFE 而非顶层 await —— vite 默认 target(es2020)不支持 TLA(实测报错)。
;(async () => {
  await ensureLocalePack(i18n.global.locale.value)
  // tt() 渲染 miss 的键 → 批量调词器(翻译表命中或机翻)→ merge → 重渲(light-mes 同款自动机翻)
  registerDictFetcher((locale, keys) => localeStore.ensureDict(locale, keys))
  localeStore.apply()
  localeStore.loadAvailable()
  app.mount('#app')
})()
