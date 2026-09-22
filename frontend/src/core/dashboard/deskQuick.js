/**
 * 「我的桌面」右上角快捷入口 —— 候选清单与可见性判定的唯一真源。
 *
 * 为什么单独成文件(2026-09-22):
 *   用户要求「右上角的按钮可以自定义,比如加入项目申请(填写立项申请表)和产品开发
 *   (填写产品信息表)」。原先按钮清单写死在 dashboard/index.vue,「工作台设置」弹窗
 *   又各写一份硬编码 checkbox —— 两边会漂移(设置里能勾的 ≠ 桌面能显示的)。
 *   现在桌面按钮与设置勾选项都从这里渲染,加一个入口只需在 QUICK_ENTRIES 加一行。
 *
 * 字段约定:
 *   key       存 localStorage.mes_desk_settings.quick(稳定标识,改中文标题不影响存储)
 *   title     按钮文案,显示层一律走 tt()
 *   path      点击后跳转的路由;/panelx/form/<面板码> 无 id 即"新增"
 *   panelCode 有值时按 user.visiblePanels 过滤(与 filterMenuTree 同一份语义,admin 全量);
 *             功能页(快速报工/生产看板)不绑面板,对所有角色可见
 *   hint      可选,按钮 title 提示(说明点进去填哪张表)
 *   primary   可选,标出主操作(只有新建加工单)
 */

/** 当前候选版本:v2 = 新增 项目申请 / 产品开发(用于给老用户增量补默认值) */
export const DESK_QUICK_VERSION = 2
/** v2 新增的候选 key —— 只给"角色默认包含它"的用户补 */
export const DESK_QUICK_V2_ADDED = ['rdApply', 'rdProduct']

export const QUICK_ENTRIES = [
  { key: 'newOrder', title: '新建加工单', path: '/panelx/form/MANU_ORDER', panelCode: 'MANU_ORDER', primary: true },
  { key: 'quickReport', title: '快速报工', path: '/prod/shop/procReport' },
  { key: 'board', title: '生产看板', path: '/prod/manufacture/board' },
  { key: 'rdApply', title: '项目申请', path: '/panelx/form/RD_APPROVAL', panelCode: 'RD_APPROVAL', hint: '填写立项申请表' },
  { key: 'rdProduct', title: '产品开发', path: '/panelx/form/RD_PROD_INFO', panelCode: 'RD_PROD_INFO', hint: '填写产品信息表' },
]

/** 该入口对当前用户是否可见:不绑面板的常显;绑面板的按 visiblePanels(admin 全量) */
function visibleFor(entry, user) {
  if (!entry.panelCode) return true
  if (user && user.isAdmin) return true
  const vis = user && Array.isArray(user.visiblePanels) ? user.visiblePanels : []
  return vis.includes(entry.panelCode)
}

/** 设置弹窗的候选(已按权限过滤):没权限的面板不给勾,免得勾了点不动 */
export function availableQuickEntries(user) {
  return QUICK_ENTRIES.filter((e) => visibleFor(e, user))
}

/** 桌面真正要渲染的按钮:勾过 + 当前可见;顺序以候选清单为准(不随勾选顺序乱) */
export function pickQuickEntries(keys, user) {
  const want = Array.isArray(keys) ? keys : []
  return QUICK_ENTRIES.filter((e) => want.includes(e.key) && visibleFor(e, user))
}

/**
 * 老用户的桌面设置增量补默认(v1→v2)。
 * 只补「本版本新增 且 角色默认包含」的 key,不动用户已有的任何选择
 * (v1 用户不可能取消过当时还不存在的入口,所以"没勾"= "没见过")。
 * 已是当前版本时返回同一引用,调用方可据此跳过落盘。
 */
export function upgradeDeskSettings(saved, { presetQuick = [], version = DESK_QUICK_VERSION } = {}) {
  if (!saved) return saved
  if (Number(saved.v || 1) >= version) return saved
  const have = Array.isArray(saved.quick) ? saved.quick : []
  const add = DESK_QUICK_V2_ADDED.filter((k) => presetQuick.includes(k) && !have.includes(k))
  return { ...saved, quick: [...have, ...add], v: version }
}
