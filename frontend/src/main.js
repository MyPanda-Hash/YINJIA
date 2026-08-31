import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles/index.css'
import * as sqlPanelRuntime from './business/engine'
import { installPanelRuntime } from './core/panel-runtime'
import { i18n } from './i18n'
import { useLocaleStore } from './stores/locale'

const app = createApp(App)

installPanelRuntime(sqlPanelRuntime)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(i18n)
// Element Plus 组件 locale 不再静态注入:由 App.vue 的 <el-config-provider>
// 响应式接管,随语言切换即时生效(顶栏下拉 / Alt+L)。
app.use(ElementPlus)

// 应用启动时把检测到的 locale 应用到 i18n 与 <html lang>;
// 拉取动态语言列表(yj_locale 注册表);外语缺失词典(翻译表/机翻)后台补齐
// (静态包词条挂载即生效,机翻补缺的零星词条下次刷新生效——翻译表已缓存)。
const localeStore = useLocaleStore()
localeStore.apply()
localeStore.loadAvailable()
localeStore.ensureDict(localeStore.locale)
app.mount('#app')
