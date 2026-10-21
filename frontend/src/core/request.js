import axios from 'axios'

/**
 * API 前缀(2026-10-20):网页部署时是站内相对路径 `/api`;
 * 而**安卓 App 里页面是从 APK 内置 assets 加载的**(file:///android_asset/www/index.html),
 * 没有"站内"这回事 ⇒ 由原生壳注入的 window.YjNative.getBaseUrl() 给出服务器地址(接口号),
 * 这里拼成 `<服务器>/api`。改地址后原生会重载页面,这里随之重算。
 */
function resolveApiBase() {
  try {
    const n = typeof window !== 'undefined' ? window.YjNative : null
    const base = n && typeof n.getBaseUrl === 'function' ? String(n.getBaseUrl() || '').trim() : ''
    if (base) return base.replace(/\/+$/, '') + '/api'
  } catch { /* 取不到就走站内相对路径 */ }
  return '/api'
}

const request = axios.create({
  baseURL: resolveApiBase(),
  timeout: 15000,
})

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('mes_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  // 多语言 P3:把当前界面语言传给后端,Spring 解析 Accept-Language 后
  // 面板配置的字段标签/面板名按 locale 从翻译表下发(数据键保持中文,ADR-0001)。
  try {
    const saved = localStorage.getItem('mes_locale')
    if (saved && saved !== 'zh-CN') config.headers['Accept-Language'] = `${saved},${saved.split('-')[0]};q=0.9,zh;q=0.5`
    else config.headers['Accept-Language'] = 'zh-CN,zh;q=0.9'
  } catch { /* 保持浏览器默认 */ }
  return config
})

request.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const status = err.response?.status
    // 401/403 都视为认证失效（后端无 token/伪造/过期返回 403）→ 同步 user store 登出并跳登录
    if (status === 401 || status === 403) {
      try {
        // 经注入的应用外壳取账号 store(分层约束:core 不许 import stores);
        // 未安装(单测等无外壳场景)时退化成清 token,与历史行为一致。
        const { useAppContext } = await import('@core/panel-runtime')
        useAppContext().user.logout()
      } catch (e) {
        localStorage.removeItem('mes_token')
      }
      if (!location.hash.includes('/login')) location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)

export default request
