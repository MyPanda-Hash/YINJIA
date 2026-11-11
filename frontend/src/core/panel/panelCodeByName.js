import { menuTree } from '@/business/menus'

/**
 * 面板中文名 → 面板编码(供应商端/列表页「来源」提示点开来源单据用)。
 *
 * 菜单树(business/menus.js)是 `title` 与 `panelCode` 成对出现的现成源头,
 * 不必为一次跳转再加一个后端接口;同一个 title 取第一次出现的(菜单里没有重名面板)。
 * 查不到返回空串 —— 调用方据此把提示降级成"只显示、不可点"。
 *
 * 单独一个文件是为了让 ./sourceHint.js 保持纯函数(node --test 不认 `@` 别名)。
 */
const PANEL_CODE_BY_NAME = (() => {
  const map = new Map()
  const walk = (nodes) => {
    for (const node of nodes || []) {
      const title = String(node?.title || '').trim()
      const code = String(node?.panelCode || '').trim()
      if (title && code && !map.has(title)) map.set(title, code)
      if (node?.children) walk(node.children)
    }
  }
  walk(menuTree)
  return map
})()

export function panelCodeOfName(name) {
  return PANEL_CODE_BY_NAME.get(String(name || '').trim()) || ''
}
