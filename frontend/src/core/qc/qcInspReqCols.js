/**
 * qcInspReqCols.js — 「来料检验要求每个页签有哪些列」的唯一判据(纯函数,无 Vue 依赖,可单测)
 *
 * 【用户口径(2026-10-04)】「检验数据要求的自定义字段,是单独针对每个表的」——
 *   每张表(页签)各有各的自定义列:给「折叠棉」表加一列「炭棒直径」,只出现在折叠棉表里;
 *   给「垫片」表也加一列叫「外观」的同名列,两张表互不影响(后端唯一性限制已改为「同页签内唯一」)。
 *
 * 【列的构成】某页签的列 = 该页签的固定列 + **属于该页签的动态字段**(备用列池):
 *   · 固定 7 张表(折叠棉/垫片/无纺布/网套/PP管/端盖/PP棉)的固定列来自 qcInspReqConfig.js(Excel 原列序);
 *   · 「自定义检验要求」页签没有固定列,只有匹配键 物料编号;
 *   · 动态字段的归属看 /px/extFields 的 fields[].tab(= yj_field.tab_key);**没有 tab 的**归
 *     「自定义检验要求」—— 那正是本改动之前它们唯一的显示位置(回填脚本之外的兜底,行为不变)。
 *   · 自定义列一律**追加在固定列之后**(不改 Excel 原列序)。
 *
 * 【为什么必须只有这一处】渲染(QcInspReqSheet)与带入检验数据记录(qcInspReqCarry)若各写一份,
 *   就会出现"界面上看得到、报告里带不进来"(或反过来)的不一致 —— 2026-10-04 实测就是这么发现的。
 */
import { normCode } from './qcInspReqLookup.js'

/** 自定义页签**必有**的匹配键列:与固定表一样,物料编号在最左 —— 检验报告正是按它找行的 */
export const EXT_KEY_COL = Object.freeze({ key: '物料编号', w: 140 })
/** 动态列取不到元数据列宽时的默认宽 */
export const DEFAULT_EXT_COL_W = 140
/** 没有归属页签的动态字段(改动前的数据)归这张表 */
export const CUSTOM_TAB_KEY = '自定义检验要求'

/** 动态字段是否属于该页签(未标注归属的按「自定义检验要求」算,与改动前行为一致) */
export function extFieldInTab(f, tabKey) {
  const tab = normCode(f?.tab) || CUSTOM_TAB_KEY
  return tab === normCode(tabKey)
}

/** 该页签的动态字段(按接口给的顺序 = yj_field.seq 序) */
export function extFieldsOfTab(extFields, tabKey) {
  return (Array.isArray(extFields) ? extFields : []).filter((f) => f && f.label && extFieldInTab(f, tabKey))
}

/**
 * 某页签的列(渲染与带入共用)。
 * @param {{key:string, dynamicCols?:boolean, cols?:Array}|null} tab 页签配置(qcInspReqTabs 的一项)
 * @param {Array<{label:string, tab?:string, parent?:string}>} extFields 动态字段(/px/extFields 的 fields)
 * @param {(label:string)=>number} [widthOf] 动态列取宽(缺省 DEFAULT_EXT_COL_W)
 * @returns {Array<{key:string, w:number, group?:string}>} 列定义(key = 数据键 = 后端下发的 label)
 *
 * 【父字段(分组表头)】动态字段可以带 parent(= yj_field.col_group):父**只做表头分组、没有数据格**,
 *   与固定表的 规格/外观 是同一套东西,所以:
 *   · 有父 ⇒ 插到该父分组**最后一个成员之后**(保持同组相邻,表头才会合并成一个跨列标题);
 *   · 父在表头里还没有 ⇒ 追加到末尾,自成一组(表格自己会画出一个新的分组标题);
 *   · 无父 ⇒ 追加到末尾(独立列,占满两行)。
 *   返回的列里**只有子字段**(每个 key 都是子字段的 label)—— 带入检验数据记录时天然只带子字段。
 */
export function colsOfTab(tab, extFields, widthOf) {
  if (!tab) return []
  const w = typeof widthOf === 'function' ? widthOf : () => DEFAULT_EXT_COL_W
  const dyn = extFieldsOfTab(extFields, tab.key).map((f) => {
    const parent = normCode(f.parent)
    return { key: f.label, w: w(f.label) || DEFAULT_EXT_COL_W, ...(parent ? { group: parent } : {}) }
  })
  const out = tab.dynamicCols ? [{ ...EXT_KEY_COL }] : (tab.cols || []).map((c) => ({ ...c }))
  for (const d of dyn) {
    let at = out.length
    if (d.group) {
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].group === d.group) { at = i + 1; break }
      }
    }
    out.splice(at, 0, d)
  }
  return out
}

/** 该页签可供选择的父字段名(分组表头候选):固定列已有的分组 + 本页签动态字段已用的父。
 *  供「自定义字段」弹窗的「父字段」下拉做候选(仍可自己新建一个父名)。 */
export function parentOptionsOfTab(tab, extFields) {
  if (!tab) return []
  const out = []
  const push = (v) => { const s = String(v ?? '').trim(); if (s && !out.includes(s)) out.push(s) }
  if (!tab.dynamicCols) for (const c of tab.cols || []) push(c.group)
  for (const f of extFieldsOfTab(extFields, tab.key)) push(f.parent)
  return out
}
