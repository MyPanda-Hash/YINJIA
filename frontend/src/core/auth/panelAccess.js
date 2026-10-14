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

/**
 * 页面级虚拟面板(2026-10-16):订单结转 / 快速排产 / 工单排产 / 生产工单列表。
 *
 * 这四个界面是**看板页面**而不是单据面板 —— 数据来自 plang / plang_pc / bl_so_order,
 * 没有 yj_panel 行,按钮也不走面板元数据(yj_button),所以动作权限不走 visiblePanels,
 * 而是由后端 AuthController 单独下发 `pagePerms`(code → perms csv,词表见
 * 后端 `PagePanelRegistry`,每个页面的动作集按该页特性裁剪)。
 *
 * 与后端真闸门同源:PanelPermissionService.requirePanelView / requireButton(同一份
 * yj_role_panel.perms)。前端只做**入口显隐** —— 拿不到权限一律不放行
 * (宁可少显示按钮,也别让用户点出一个 403)。
 */
export const PAGE_PANELS = Object.freeze({
  ORDER_CONVERT: 'ORDER_CONVERT',
  SCHEDULE_BOARD: 'SCHEDULE_BOARD',
  WORK_ORDER_BOARD: 'WORK_ORDER_BOARD',
  WORK_ORDER_LIST: 'WORK_ORDER_LIST',
})

/**
 * 「当前账号在某页面面板上能不能执行某个动作」的纯判定。
 *
 * @param {{isAdmin?:boolean, pagePerms?:Record<string,string>}|null|undefined} user
 * @param {string} panelCode 页面面板码(见 PAGE_PANELS)
 * @param {string} word 动作词(view/query/convert/assign/…;见后端 PagePanelRegistry)
 * @returns {boolean}
 */
export function canDo(user, panelCode, word) {
  const code = String(panelCode ?? '').trim()
  const w = String(word ?? '').trim()
  if (!code || !w) return false
  if (!user) return false
  if (user.isAdmin === true) return true
  const map = user.pagePerms
  const csv = map && typeof map === 'object' ? map[code] : ''
  if (!csv) return false
  if (String(csv).trim() === '*') return true
  return String(csv).split(',').some((p) => p.trim() === w)
}

/**
 * 「任一页面上持有该动作词」—— 对应后端 requireButtonAny:
 * 同一动作有两个入口时(如「排产」在快速排产页与生产工单页各一个按钮),
 * 任一处授予即可;两处都没授则为 false。
 */
export function canDoAny(user, panelCodes, word) {
  const list = Array.isArray(panelCodes) ? panelCodes : []
  return list.some((code) => canDo(user, code, word))
}
