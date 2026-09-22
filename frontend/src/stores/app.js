import { defineStore } from 'pinia'
import { DESK_QUICK_VERSION, upgradeDeskSettings as upgradeQuick } from '@core/dashboard/deskQuick'

const DESK_DEFAULT = {
  quick: ['newOrder', 'quickReport', 'board'],
  showKpi: true,
  showProgress: true,
  showTodo: true,
}
// 注意:DESK_DEFAULT 刻意不带 v —— loadDeskSettings 会把默认值摊到存储值上,
// 若默认值里有 v,老用户(v1)会被误判成"已升级",增量补默认就永不执行。

/**
 * 角色预设(2026-09-22 桌面展示优化):只在「用户从未保存过桌面设置」时套用**一次**。
 *   · 管理员:全局视角 —— 生产执行核心 + 质量待办 + 事件流/数据内核都在,快捷入口带
 *     研发两个入口(项目申请/产品开发) —— 填表是管理员的日常起点;
 *   · 普通用户:聚焦「要我做/要我看」—— 首屏 KPI + 质量与待办为主,生产执行核心默认收起
 *     (它是长列表+图表,对仓管/工艺员这类角色日常价值低),快捷入口只留「新建加工单」,
 *     研发两个入口默认不勾(车间账号用不上,且多无该面板权限,勾了也点不动)。
 * 用户在工作台设置里改过之后就不再覆盖(以 localStorage 里的保存值为准)。
 * 注:快速报工/生产看板已于 2026-09-22 从候选中下架(无对应功能),预设里不再出现。
 */
const DESK_PRESET_ADMIN = { ...DESK_DEFAULT, v: DESK_QUICK_VERSION, quick: ['newOrder', 'rdApply', 'rdProduct'] }
const DESK_PRESET_USER = { ...DESK_DEFAULT, v: DESK_QUICK_VERSION, quick: ['newOrder'], showProgress: false }

function deskSavedByUser() {
  try {
    return !!localStorage.getItem('mes_desk_settings')
  } catch (e) {
    return false
  }
}

function loadDeskSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('mes_desk_settings') || 'null')
    return s ? { ...DESK_DEFAULT, ...s } : { ...DESK_DEFAULT }
  } catch (e) {
    return { ...DESK_DEFAULT }
  }
}

export const useAppStore = defineStore('app', {
  state: () => ({
    collapsed: localStorage.getItem('mes_collapsed') === '1',
    dark: localStorage.getItem('mes_dark') === '1',
    menuMode: localStorage.getItem('mes_menu_mode') || 'accordion',
    fullscreen: false,
    deskSettings: loadDeskSettings(),
    // T+ 门户形态：内容区最大化（隐藏左侧导航）
    maxContent: false,
    // 移动端：左侧导航抽屉开关（≤768px 生效）
    mobileNav: false,
    // 右侧帮助面板
    helpVisible: false,
    helpTab: 'dynamic',
    // MES 初始化向导（首次登录自动弹出，之后可从用户下拉再次打开）
    initWizardVisible: false,
    initDone: localStorage.getItem('mes_init_done') === '1',
  }),
  actions: {
    toggleCollapse() {
      this.collapsed = !this.collapsed
      localStorage.setItem('mes_collapsed', this.collapsed ? '1' : '0')
    },
    toggleDark() {
      this.dark = !this.dark
      localStorage.setItem('mes_dark', this.dark ? '1' : '0')
      document.documentElement.classList.toggle('dark', this.dark)
    },
    setMenuMode(mode) {
      this.menuMode = mode
      localStorage.setItem('mes_menu_mode', mode)
    },
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
        this.fullscreen = true
      } else {
        document.exitFullscreen()
        this.fullscreen = false
      }
    },
    toggleMaxContent() {
      this.maxContent = !this.maxContent
    },
    toggleMobileNav() {
      this.mobileNav = !this.mobileNav
    },
    openHelp(tab) {
      this.helpVisible = true
      if (tab) this.helpTab = tab
    },
    closeHelp() {
      this.helpVisible = false
    },
    openInitWizard() {
      this.initWizardVisible = true
    },
    closeInitWizard(skip) {
      this.initWizardVisible = false
      if (skip) {
        this.initDone = true
        localStorage.setItem('mes_init_done', '1')
      }
    },
    finishInitWizard() {
      this.initDone = true
      localStorage.setItem('mes_init_done', '1')
    },
    saveDeskSettings(patch) {
      this.deskSettings = { ...this.deskSettings, ...patch }
      localStorage.setItem('mes_desk_settings', JSON.stringify(this.deskSettings))
    },
    /** 首次进入桌面时按角色套预设;返回是否套用了(用户已保存过则不动,返回 false) */
    applyRoleDeskPreset(isAdmin) {
      if (deskSavedByUser()) return false
      this.deskSettings = { ...(isAdmin ? DESK_PRESET_ADMIN : DESK_PRESET_USER) }
      localStorage.setItem('mes_desk_settings', JSON.stringify(this.deskSettings))
      return true
    },
    /**
     * 新候选上线时的增量补默认(v1→v2:项目申请/产品开发)。
     * 老用户(已保存过设置)不会走 applyRoleDeskPreset,若不补就永远看不到新按钮;
     * 只补"角色默认包含且用户没见过"的 key,用户自己的勾选一律不动。
     */
    upgradeDeskSettings(isAdmin) {
      const cur = this.deskSettings
      const next = upgradeQuick(cur, { presetQuick: (isAdmin ? DESK_PRESET_ADMIN : DESK_PRESET_USER).quick })
      if (next === cur) return false
      this.deskSettings = next
      localStorage.setItem('mes_desk_settings', JSON.stringify(next))
      return true
    },
  },
})
