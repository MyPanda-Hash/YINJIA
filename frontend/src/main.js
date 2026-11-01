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
// 换肤令牌必须在 index.css 之后:两边的选择器特异性是 html[data-skin] > :root,
// 但同层规则仍按加载顺序决胜,顺序反了会留下零星的"默认绿"。
import './styles/skins.css'
import * as sqlPanelRuntime from './business/engine'
import { installAppContext, installPanelRuntime } from './core/panel-runtime'
import { i18n, registerDictFetcher, ensureLocalePack } from './i18n'
import { useLocaleStore } from './stores/locale'
import { useTabsStore } from './stores/tabs'
import { useUserStore } from './stores/user'

const app = createApp(App)

// 动态 import 失败兜底(2026-10-18):部署后旧 chunk 404 / 网络瞬断,会让"点菜单"一直转圈。
// Vite 对 preload 失败会派发 vite:preloadError;路由懒加载失败由 router.onError 接(见 router/index.js)。
// 两种都**自动重载一次**(带 _r 破缓存;60 秒内只重试一次,避免死循环刷新)。
;(function () {
  const KEY = 'mes_chunk_reload_at'
  window.__MES_RELOAD_ONCE__ = function (reason) {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 60000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
    console.warn('[boot] 动态资源加载失败,自动刷新一次:', reason)
    const u = location.pathname + location.search.replace(/[?&]_r=\d+/, '')
    location.replace(u + (u.indexOf('?') >= 0 ? '&' : '?') + '_r=' + Date.now() + location.hash)
    return true
  }
  window.addEventListener('vite:preloadError', (e) => {
    if (window.__MES_RELOAD_ONCE__(e?.payload?.message || 'preload')) e.preventDefault()
  })
})()


// 手机端桌面预览(2026-10-21 用户口径「拿手机看很麻烦」):
// DevTools 设备模拟能看布局/断点,但**不实现 env(safe-area-inset-*)**,挖孔屏安全区恒为 0
// ⇒ 电脑上永远看不出「被摄像头顶住」这类问题。开发服(Vite)支持 URL 参数直接模拟:
//   http://localhost:5173/?safeTop=44&safeBottom=34
// 只改 CSS 变量(见 PortalLayout / LeftNav 的 var(--yj-safe-top, env(...))),不写死任何尺寸;
// import.meta.env.DEV 为 false 时整段被摇树删掉,生产包里不存在。
;(function () {
  if (!import.meta.env.DEV) return
  const q = new URLSearchParams(location.search)
  const set = (name, raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) return
    document.documentElement.style.setProperty(name, `${Math.min(n, 200)}px`)
  }
  set('--yj-safe-top', q.get('safeTop'))
  set('--yj-safe-bottom', q.get('safeBottom'))
})()

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
//
// 🔴 2026-10-18:语言包加载加**超时上限**(3 秒),超时也照常挂载。
//   原因(现场报障「刷新页面一直转圈」):语言包是**动态 import**(浏览器自己发请求,不走 axios,
//   没有超时)。页面空闲久了,浏览器可能复用一条已被 NAT/防火墙静默丢弃的长连接 ——
//   那条 import 会**一直挂着**,而 app.mount() 在它后面 ⇒ 页面永远白屏,后端日志里一条都看不到
//   (请求根本没到服务器)。现在最多等 3 秒:包若晚到,vue-i18n 的 mergeLocaleMessage 是响应式的,
//   界面会自动补上译名;包若失败,退回中文,不挡住整个系统。
const PACK_TIMEOUT_MS = 3000
;(async () => {
  const pack = ensureLocalePack(i18n.global.locale.value)
  await Promise.race([pack, new Promise((r) => setTimeout(r, PACK_TIMEOUT_MS))])
  // tt() 渲染 miss 的键 → 批量调词器(翻译表命中或机翻)→ merge → 重渲(light-mes 同款自动机翻)
  registerDictFetcher((locale, keys) => localeStore.ensureDict(locale, keys))
  localeStore.apply()
  localeStore.loadAvailable()
  app.mount('#app')
  window.__MES_MOUNTED__ = true
  // 超时后包才到:再 apply 一次(让 <html lang> 等外壳状态跟上;词条本身由 vue-i18n 响应式生效)
  pack.then(() => { if (document.querySelector('#app > *')) localeStore.apply() }).catch(() => {})
})()
