import axios from 'axios'
import { apiBase, apiOrigin, API_ORIGIN_KEY } from '@/business/appConfig'

/**
 * API 前缀(2026-10-25 合并后收敛):
 *
 * 地址解析**唯一真源 = `@/business/appConfig`**(`apiBase()` / `apiOrigin()` / `setApiOrigin()`),
 * 本文件不再自己实现一份 —— 之前 HEAD 与 origin/main 各有一套(YjNative + localStorage 手写 vs appConfig),
 * 合并时保留了远端这份:① 网页部署走站内相对 `/api`;② 安卓壳(Capacitor)按 appConfig 里的
 * 服务器地址(用户在登录页「服务器地址」填,存 localStorage `mes_api_origin`)。
 *
 * 这里**re-export** 旧名字,是为了不打断既有 `import { apiOrigin, API_ORIGIN_KEY } from '@core/request'` 的调用方。
 */
export { apiOrigin, API_ORIGIN_KEY }

const request = axios.create({
  // App(Capacitor 壳)里没有 Vite 代理,必须打后端绝对地址;浏览器里仍走同源 /api。
  baseURL: apiBase() + '/api',
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
