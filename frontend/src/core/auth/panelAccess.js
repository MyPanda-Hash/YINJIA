/**
 * panelAccess.js — 「当前账号能不能查看某个面板」的纯判定。
 *
 * 口径与导航/桌面入口**同一真源**(`business/menus.js` 的 filterMenuTree、
 * `core/dashboard/deskQuick.js`):admin 全量;其余账号看 `user.visiblePanels`
 * (后端 AuthController 按角色面板权限下发)。拿不到用户信息时**一律不放行** ——
 * 宁可提示无权限,也不要放进去吃一个 403 白屏。
 *
 * 用例:产品文件列表点某个文件的「状态」跳转到该文件面板之前的预检
 * (2026-09-30 用户口径:没有该面板查看权限时提示「无查看该面板的权限」)。
 */

/**
 * @param {{isAdmin?:boolean, visiblePanels?:string[]}|null|undefined} user
 * @param {string} panelCode
 * @returns {boolean}
 */
export function canViewPanel(user, panelCode) {
  const code = String(panelCode ?? '').trim()
  if (!code) return false
  if (!user) return false
  if (user.isAdmin === true) return true
  const vis = Array.isArray(user.visiblePanels) ? user.visiblePanels : []
  return vis.includes(code)
}
