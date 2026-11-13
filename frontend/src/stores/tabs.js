import { defineStore } from 'pinia'

/**
 * 页签身份 = **不含 query 的路径**。
 *
 * 为什么单独抽出来(2026-11-11「打开多个单,这个单的名字反复横跳」的一半原因):
 *   页签的 `path` 同时被三处当键用 —— 菜单建页签、PortalLayout 的 keep-alive `:key`、
 *   面板"按路径找自己那个页签再改标题"。只要有一处传了 `route.fullPath`(带 `?code=`/`?docNo=`),
 *   去重就失效(← 页签栏出现两个同名页签),面板也找不到自己那条(← 标题改不动/改到别人头上)。
 *   query 是"同一页签内的位置",不该参与身份判定。
 */
export function tabKey(path) {
  return String(path || '').split('?')[0].split('#')[0]
}

export const useTabsStore = defineStore('tabs', {
  state: () => ({
    tabs: [{ title: '我的桌面', path: '/dashboard', affix: true }],
    active: '/dashboard',
  }),
  actions: {
    open(menu) {
      const path = tabKey(menu.path)
      const ex = this.tabs.find((t) => t.path === path)
      if (ex) {
        // 同一路径再次打开：更新标题与查询参数（如单据表单的 ?code=）
        // 防污染：已打开具体单据标签时，忽略「X-新增」标签请求（避免标题/查询被覆盖）
        const isNewReq = typeof menu.title === 'string' && menu.title.endsWith('-新增')
        const exIsNew = typeof ex.title === 'string' && ex.title.endsWith('-新增')
        if (isNewReq && !exIsNew) {
          this.active = path
          return
        }
        if (menu.title) ex.title = menu.title
        if (menu.query) ex.query = { ...menu.query }
      } else {
        this.tabs.push({ title: menu.title, path, query: menu.query ? { ...menu.query } : {}, affix: false })
      }
      this.active = path
    },
    // 路由变化时同步活动页签的 query/标题——保证切换页签回来能恢复（含 ?code= 单据参数，修复「生单后切换单据数据丢失」）
    sync(route) {
      // 只同步查询参数（如 ?code=单据号），不覆盖标题——标题由打开方设置（如 生产加工单-MO-xxx）
      const t = this.tabs.find((x) => x.path === route.path)
      if (t) t.query = { ...route.query }
    },
    setActive(path) {
      this.active = path
    },
    close(path) {
      const idx = this.tabs.findIndex((t) => t.path === path)
      if (idx === -1) return
      const tab = this.tabs[idx]
      if (tab.affix) return
      this.tabs.splice(idx, 1)
      if (this.active === path) {
        this.active = this.tabs[Math.min(idx, this.tabs.length - 1)]?.path || '/dashboard'
      }
    },
    closeOthers(path) {
      this.tabs = this.tabs.filter((t) => t.affix || t.path === path)
      this.active = path
    },
    closeAll() {
      this.tabs = this.tabs.filter((t) => t.affix)
      this.active = '/dashboard'
    },
  },
})
