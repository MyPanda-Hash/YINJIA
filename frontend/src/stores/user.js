import { defineStore } from 'pinia'
import { apiLogin, apiGetUserInfo } from '@/business/api'
import { pickCurrentFactory } from '@core/auth/factory'

export const useUserStore = defineStore('user', {
  state: () => {
    let ui = null
    try { ui = JSON.parse(localStorage.getItem('mes_user') || 'null') } catch {}
    return {
      token: (() => { const t = localStorage.getItem('mes_token'); return t && t !== 'undefined' ? t : '' })(),
      userInfo: ui,
      factory: (() => { try { return JSON.parse(localStorage.getItem('mes_factory') || 'null') } catch { return null } })(),
      factories: [],
      loginDate: '',
      roleCode: ui?.roleCode || '',
      isAdmin: !!ui?.isAdmin,
      visiblePanels: Array.isArray(ui?.visiblePanels) ? ui.visiblePanels : [],
      approvePanels: Array.isArray(ui?.approvePanels) ? ui.approvePanels : [],
    }
  },
  getters: {
    isLogin: (s) => !!s.token,
    realName: (s) => s.userInfo?.realName || s.userInfo?.userName || '',
    factoryName: (s) => s.factory?.name || '',
    // T+ 顶栏中区：登录日期（登录时记录）
    loginDateText: (s) => s.loginDate || localStorage.getItem('mes_login_date') || '--',
    // T+ 顶栏中区：服务到期时间（后续由 SQL 后端账号信息提供）
    serviceEnd: (s) => s.userInfo?.serviceEnd || '2027-08-13',
    account: (s) => s.userInfo?.userName || '',
  },
  actions: {
    async login(payload) {
      const res = await apiLogin(payload)
      this.token = res.token
      this.userInfo = res.user
      this.applyPerms(res.user)
      const today = new Date().toISOString().slice(0, 10)
      this.loginDate = today
      localStorage.setItem('mes_token', res.token)
      localStorage.setItem('mes_user', JSON.stringify(res.user))
      localStorage.setItem('mes_login_date', today)
      // 账套以**登录响应**为准(后端把令牌声明里的 factory 一并返回):
      // 顶栏/桌面显示的名字必须等于"正在被查询的那个库",不能由可陈旧的缓存说了算。
      // 账套清单可能还没加载(直接调 API 登录的场景),先记 code,名字由 fetchFactories 补齐。
      if (res.user && res.user.factory) {
        const code = res.user.factory
        const hit = this.factories.find((f) => f && f.code === code)
        this.factory = hit || { code, name: this.factory && this.factory.code === code ? this.factory.name : '' }
        localStorage.setItem('mes_factory', JSON.stringify(this.factory))
      }
      return res
    },
    // 从登录/用户信息中提取角色权限
    applyPerms(u) {
      this.roleCode = u?.roleCode || ''
      this.isAdmin = !!u?.isAdmin
      this.visiblePanels = Array.isArray(u?.visiblePanels) ? u.visiblePanels : []
      this.approvePanels = Array.isArray(u?.approvePanels) ? u.approvePanels : []
    },
    // 刷新权限（角色/面板配置变更后调用）
    async fetchPerms() {
      const { apiGetPerms } = await import('@/business/api')
      const p = await apiGetPerms()
      if (!p) return
      this.roleCode = p.roleCode || ''
      this.isAdmin = !!p.isAdmin
      this.visiblePanels = Array.isArray(p.visiblePanels) ? p.visiblePanels : []
      this.approvePanels = Array.isArray(p.approvePanels) ? p.approvePanels : []
      if (this.userInfo) {
        this.userInfo = { ...this.userInfo, roleCode: this.roleCode, isAdmin: this.isAdmin, visiblePanels: this.visiblePanels, approvePanels: this.approvePanels }
        localStorage.setItem('mes_user', JSON.stringify(this.userInfo))
      }
    },
    async fetchUserInfo() {
      const info = await apiGetUserInfo()
      this.userInfo = info
      this.applyPerms(info)
      localStorage.setItem('mes_user', JSON.stringify(info))
    },
    async fetchFactories() {
      const { apiGetFactories } = await import('@/business/api')
      this.factories = await apiGetFactories()
      // 当前账套 = 会话里那个(令牌声明随登录响应进来),缓存只作兜底 —— 见 core/auth/factory.js
      const latest = pickCurrentFactory(this.factories, {
        sessionCode: this.userInfo && this.userInfo.factory,
        cachedCode: this.factory && this.factory.code,
      })
      if (latest) {
        // Replace the whole cached object so corrected names/addresses take effect
        // after a database repair without requiring users to clear localStorage.
        this.factory = latest
        localStorage.setItem('mes_factory', JSON.stringify(this.factory))
      }
    },
    /**
     * 切换账套(工厂)。2026-09-22 修正:原先这里只改本地对象 + localStorage,令牌没换,
     * 后端仍按旧令牌声明路由到旧库 —— 名字变了数据没变,用户报的"无效、并未切换"就是这个。
     * 现在按 ADR-0003 走"用目标账套的密码重新登录"(调用方传入 login):
     *   · 验密在**目标账套**上做(AuthController 先路由再查 yj_user);
     *   · 换掉令牌 ⇒ 后续请求由 JwtAuthFilter 按新声明路由到新库;
     *   · 成功后调用方负责刷新页面,让菜单/面板/数据全部按新库重建。
     * 失败原样抛出(密码错/该账套无此账号),由调用方展示,不改动当前会话。
     */
    async switchFactory(target, password) {
      if (!target || !target.code) throw new Error('未选择账套')
      const res = await this.login({
        userName: this.account || (this.userInfo && this.userInfo.userName),
        password,
        factory: target.code,
      })
      return res
    },
    logout() {
      this.token = ''
      this.userInfo = null
      this.roleCode = ''
      this.isAdmin = false
      this.visiblePanels = []
      this.approvePanels = []
      localStorage.removeItem('mes_token')
      localStorage.removeItem('mes_user')
    },

  },
})
