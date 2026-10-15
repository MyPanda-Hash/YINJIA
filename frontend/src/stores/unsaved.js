import { defineStore } from 'pinia'

/**
 * 「未保存内容」登记处 —— 页签栏(×关闭)与面板内离开守卫之间的桥。
 *
 * 背景(2026-10-16 用户口径):
 *   「填写的表格数据,无论是在切换 tab 页还是面板在未×掉之前都是保留的,叉掉时还应该弹窗提示是否保存」。
 *   未保存状态原本只活在 PanelxList 实例里(hasUnsavedChanges),页签栏拿不到 ⇒ × 关闭时问不了。
 *   面板挂载时把自己的 { hasUnsaved, save, discard, confirmLeave } 登记进来,页签栏按 path 取。
 *
 * 只放"当前活着的面板实例"的引用;面板卸载即注销。键 = 页签路径(与 tabs store 的 t.path 同口径)。
 */
export const useUnsavedStore = defineStore('unsaved', {
  state: () => ({ reg: {} }),
  actions: {
    register(path, api) {
      if (path && api) this.reg[path] = api
    },
    unregister(path) {
      if (path) delete this.reg[path]
    },
    apiOf(path) {
      return (path && this.reg[path]) || null
    },
  },
})

/**
 * 关闭页签前的判定(纯函数,便于单测;TabsBar 只负责按 step 执行):
 *   api 缺失/没有 hasUnsaved/不脏          → { step: 'close' }    直接关
 *   脏且还没问过(choice=null)              → { step: 'ask' }      弹三态确认框
 *   用户选 保存 / 不保存 / 取消             → { step: 'save' | 'discard' | 'cancel' }
 * 注意:save 之后是否真关由调用方看 api.save() 的返回值(校验没过就别关)。
 */
export function tabClosePlan(api, choice = null) {
  const dirty = !!(api && typeof api.hasUnsaved === 'function' && api.hasUnsaved())
  if (!dirty) return { step: 'close' }
  if (choice === null || choice === undefined) return { step: 'ask' }
  if (choice === 'cancel') return { step: 'cancel' }
  if (choice === 'save') return { step: 'save' }
  return { step: 'discard' }
}
