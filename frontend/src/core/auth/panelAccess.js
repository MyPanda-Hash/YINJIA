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

/**
 * 「当前账号能不能配置该面板的自定义字段(动态字段/备用列池)」的纯判定。
 *
 * 口径(2026-10-09 用户口径):「自定义字段需要在组织权限里面能够配置;
 * 现在的来料检验要求的自定义字段只要超级管理员能够配置。」
 * ⇒ 权限不再是 is_admin 硬判,而是组织架构 →「角色与面板权限」里逐面板勾的「自定义字段」
 *   (yj_role_panel.perms 的 field 词,后端 AuthController 下发 fieldPanels;管理员一律 ['*'])。
 *
 * 与后端真闸门同源:PanelPermissionService.requireFieldConfig(panelCode) 用的就是同一个词,
 * 前端只做入口显隐 —— 拿不到权限信息时**一律不放行**(宁可看不到入口,也别放进去吃 403)。
 *
 * @param {{isAdmin?:boolean, fieldPanels?:string[]}|null|undefined} user
 * @param {string} panelCode
 * @returns {boolean}
 */
export function canConfigFields(user, panelCode) {
  const code = String(panelCode ?? '').trim()
  if (!code) return false
  if (!user) return false
  if (user.isAdmin === true) return true
  const list = Array.isArray(user.fieldPanels) ? user.fieldPanels : []
  return list.includes('*') || list.includes(code)
}
