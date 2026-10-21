import axios from 'axios'

/**
 * API 前缀(2026-10-20,两轮):
 *
 * ① 网页部署:站内相对路径 `/api`(页面就是从后端同源加载的)。
 * ② 安卓壳(手搓 Activity,file:///android_asset/www):由原生注入的
 *    `window.YjNative.getBaseUrl()` 给出服务器地址(接口号),拼成 `<服务器>/api`。
 * ③ 安卓壳(Capacitor 版,页面 origin 是 `https://localhost`):没有同源、也没有 YjNative,
 *    地址来自 **localStorage 的 `mes_api_origin`**(用户在登录页「服务器地址」里填),
 *    与参考包 `银嘉扫码领料.apk` 同一套键名(`mes_api_origin`),两边可互相沿用配置。
 *
 * 优先级:YjNative > localStorage.mes_api_origin > 构建期 VITE_API_ORIGIN > '/api'。
 * 改地址后需要重新登录(页面会 reload,本函数随之重算)。
 */
export const API_ORIGIN_KEY = 'mes_api_origin'

function normalizeOrigin(v) {
  const s = String(v == null ? '' : v).trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(s)) return ''
  return s
}

/** 当前生效的服务器地址(没有就返回空串 = 走站内相对路径) */
export function apiOrigin() {
  try {
    const n = typeof window !== 'undefined' ? window.YjNative : null
    const fromNative = n && typeof n.getBaseUrl === 'function' ? normalizeOrigin(n.getBaseUrl()) : ''
    if (fromNative) return fromNative
  } catch { /* ignore */ }
  try {
    const saved = normalizeOrigin(localStorage.getItem(API_ORIGIN_KEY))
    if (saved) return saved
  } catch { /* ignore */ }
  try {
    const env = normalizeOrigin(import.meta.env && import.meta.env.VITE_API_ORIGIN)
    if (env) return env
  } catch { /* ignore */ }
  return ''
}

function resolveApiBase() {
  const origin = apiOrigin()
  return origin ? origin + '/api' : '/api'
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
