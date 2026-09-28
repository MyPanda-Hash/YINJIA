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
import { installPanelRuntime } from './core/panel-runtime'
import { i18n, registerDictFetcher } from './i18n'
import { useLocaleStore } from './stores/locale'

const app = createApp(App)

installPanelRuntime(sqlPanelRuntime)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(ElLoading)

// 应用启动时把检测到的 locale 应用到 i18n 与 <html lang>;
// 拉取动态语言列表(yj_locale 注册表);外语缺失词典(翻译表/机翻)后台补齐
// (静态包词条挂载即生效,机翻补缺的零星词条下次刷新生效——翻译表已缓存)。
const localeStore = useLocaleStore()
// tt() 渲染 miss 的键 → 批量调词器(翻译表命中或机翻)→ merge → 重渲(light-mes 同款自动机翻)
registerDictFetcher((locale, keys) => localeStore.ensureDict(locale, keys))
localeStore.apply()
localeStore.loadAvailable()
app.mount('#app')
