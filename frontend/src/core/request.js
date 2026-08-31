import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
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
        const { useUserStore } = await import('@/stores/user')
        useUserStore().logout()
      } catch (e) {
        localStorage.removeItem('mes_token')
      }
      if (!location.hash.includes('/login')) location.hash = '#/login'
    }
    return Promise.reject(err)
  }
)

export default request
