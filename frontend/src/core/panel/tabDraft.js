/**
 * 「切换页签不丢未保存填写」的纯逻辑:身份键 / 找回 / 何时该丢。
 *
 * 为什么需要(2026-10-15 用户报障「在标签页面切换时,有时候未保存的数据会自动清理,
 * 应该是在未×掉页面的时候就应该保留填写的数据」):
 *
 *   未保存的填写**不另存一份**,它就长在列表行对象上 —— PanelxList 把 `cur`(= `list[curIdx]`
 *   那一行)当 `:head` 传给文书面板,子组件 `props.head['字段'] = v` 直接改这行;
 *   而切面板时那段代码会 `list.value = []` 再重载(见 PanelxList 的 panelCode watcher),
 *   行对象连同填写内容一起被丢掉,回来时是服务端的新行 ⇒ 看起来"自动清理"。
 *
 *   活体实测(Edge+CDP,测试账套,两张草稿文书面板互切):
 *     · 顶部页签互切:Rd_MOLD_PROC 里填的值,切到 Rd_ASM_PROC 再切回 = 空(且**不弹**任何提示);
 *     · 同一面板内部页签互切:值原样保留(内部页签是 v-show,与本次无关)。
 *
 *   抢救办法只有一个方向:离开前把**那张单**(含未保存填写)按面板号暂存,回来时按单号
 *   找回同一行并放回。本模块是这条链的可测内核,组件只负责调用与持有 Map。
 */

/**
 * 单据身份键 —— 口径与 PanelxList 里「列表定位」完全一致(`编号 || 单据编号 || 锭号`)。
 * 一律 String,空值视为"没有",继续回退;都取不到 ⇒ 空串(既不能暂存也不能找回)。
 */
export function docKeyOf(row) {
  if (!row) return ''
  for (const k of ['编号', '单据编号', '锭号']) {
    const v = row[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v)
  }
  return ''
}

/**
 * 在**新载入**的行集里找回被暂存的那张单。
 * @param {Array<Record<string, any>>|null} rows 本次载入的列表行
 * @param {Record<string, any>|null} stashed 暂存的那行(含未保存填写)
 * @returns {{index: number, row: Record<string, any>}|null} row 是 rows 里的**同一个对象**
 *          (调用方对它 Object.assign 即可把填写放回,行在列表里的位置不变)
 */
export function findStashedRow(rows, stashed) {
  const key = docKeyOf(stashed)
  if (!key || !Array.isArray(rows)) return null
  const index = rows.findIndex((r) => docKeyOf(r) === key)
  return index < 0 ? null : { index, row: rows[index] }
}

/** 列表页页签的路径前缀(与菜单/PortalLayout 建页签的 path 同形) */
export const LIST_TAB_PREFIX = '/panelx/list/'

/**
 * 哪些暂存该丢 —— **页签被×掉才丢**(用户口径:没×掉就该保留)。
 * @param {string[]} stashKeys 暂存表里的面板号
 * @param {string[]|undefined} tabPaths 当前打开的页签路径(useTabsStore().tabs 的 path)
 * @returns {string[]} 应当从暂存里删除的面板号
 * 拿不到页签清单(undefined/非数组)时**一律不丢**:宁可多留一会儿,也不能把用户填的丢掉。
 * 表单页页签(`/panelx/form/...`)不算数 —— 它不是这张列表页。
 */
export function stashKeysToDrop(stashKeys, tabPaths) {
  if (!Array.isArray(tabPaths)) return []
  const alive = new Set(
    tabPaths
      .map((p) => String(p || ''))
      .filter((p) => p.startsWith(LIST_TAB_PREFIX))
      .map((p) => p.slice(LIST_TAB_PREFIX.length)),
  )
  return (stashKeys || []).map((k) => String(k)).filter((k) => !alive.has(k))
}
