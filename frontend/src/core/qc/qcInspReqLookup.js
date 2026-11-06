/**
 * qcInspReqLookup.js — 「按物料编码查看来料检验要求」纯逻辑(无 Vue 依赖,可单测)
 *
 * 场景(2026-09-23 用户口径:「检验数据记录要根据物料编码能够查看来料检验要求相关物料的信息」):
 *   检验数据记录(QC_INSP_REC)的抬头有「物料编码」,而该物料的检验要求维护在
 *   来料检验要求(QC_INSP_REQ,7 页签档案表)里 —— 录入/查看报告时要能直接看到对应要求。
 *
 * 匹配口径:
 *   · 键 = 检验数据记录.物料编码 ↔ 来料检验要求.物料编号,两侧 trim 后**精确相等**。
 *     不用模糊匹配:物料编号是唯一规格标识(实测 78 行 = 78 个不同编号),
 *     LIKE '%code%' 会把 YJ-AJ-001 与 YJ-AJ-0011 这类串起来 —— 库里暂时没有,但口径上不留这个口子。
 *   · 分组 = 按行上的「物料类别」归到 7 个页签之一,顺序**循 qcInspReqTabs 的配置序**
 *     (与维护面板页签顺序一致,不按数据出现顺序);组内按 id 升序(对齐 Excel 原序)。
 *   · 配置外的物料类别(理论上不会有:物料类别是 7 值下拉)也**不静默丢弃** ——
 *     作为 unknown 组返回,由调用方提示,免得"该物料有要求却看不见"。
 */
import { qcInspReqTabs } from '../views/qcInspReqConfig.js'

/** 物料编号/编码归一:去首尾空白(null/undefined → 空串) */
export function normCode(v) {
  return String(v ?? '').trim()
}

/** 行 id 升序(无 id 的新行殿后) */
function byIdAsc(a, b) {
  return (a?.id ?? Number.MAX_SAFE_INTEGER) - (b?.id ?? Number.MAX_SAFE_INTEGER)
}

/**
 * 从档案全量行里挑出该物料的检验要求行(精确匹配 物料编号)。
 * @param {Array<object>} rows 来料检验要求全量行
 * @param {string} materialCode 检验数据记录的物料编码
 * @returns {Array<object>} 匹配行(保持原顺序)
 */
export function matchReqRowsByMaterial(rows, materialCode) {
  const code = normCode(materialCode)
  if (!code || !Array.isArray(rows)) return []
  return rows.filter((r) => r && normCode(r['物料编号']) === code)
}

/**
 * 匹配行 → 按页签分组(配置序;配置外类别作为 tab=null 的组殿后)。
 * @param {Array<object>} matched 命中行
 * @param {Array<object>} [tabs] 页签配置全集 —— **默认** QC_INSP_REQ 的 7 张固定表;
 *        检验数据记录要同时看两个面板(固定表 + 10 张系列表)⇒ 调用方传全集
 *        ([...qcInspReqTabs, ...系列面板的 10 个页签])。
 * @returns {Array<{key: string, tab: object|null, rows: Array<object>}>}
 */
export function reqGroupsOf(matched, tabs) {
  const list = Array.isArray(matched) ? matched : []
  const all = Array.isArray(tabs) && tabs.length ? tabs : qcInspReqTabs
  const groups = []
  const used = new Set()
  for (const tab of all) {
    const rows = list.filter((r) => r && normCode(r['物料类别']) === tab.key).slice().sort(byIdAsc)
    if (rows.length) {
      groups.push({ key: tab.key, tab, rows })
      rows.forEach((r) => used.add(r))
    }
  }
  const rest = list.filter((r) => r && !used.has(r)).slice().sort(byIdAsc)
  if (rest.length) groups.push({ key: '', tab: null, rows: rest })
  return groups
}

/** 匹配行里落在配置页签上的页签 key 列表(供只读嵌入时只渲染命中页签) */
export function reqTabKeysOf(groups) {
  return (Array.isArray(groups) ? groups : []).filter((g) => !!g.tab).map((g) => g.key)
}

/* ═══════════════ 归不进页签的行(orphan)——「库里有的,界面上必须看得到」(2026-11-06)═══════════════
 * 场景(用户报障同批):某物料的检验要求行,「物料类别」写的是**已下线页签**的值(如 2026-10-04 拆面板后
 * 下线的「自定义检验要求」)或干脆是脏值 —— 现役 17 个页签(7 固定 + 10 系列)一个都装不下它:
 *   · 维护面板里永远看不到、也改不了(没有页签承载);
 *   · 检验数据记录弹窗原先只把它**计个数**(「另有 N 行物料类别不在检验要求模板中」),不显示内容;
 *   · 而「带入检验要求」却会按行自身字段名把它带进报告 ⇒ 弹窗看不见、报告带得进来。
 * 故这里把这类行单独成组,由调用方渲染成「{类别} · 未归类」只读页签,并保留按 物料类别 的原始值分组
 * (一个类别一个页签;空类别自成一组,key='')。
 */

/** 组集里「归不进页签」的行(tab=null 的组展平;顺序 = 组内 id 升序) */
export function orphanRowsOf(groups) {
  return (Array.isArray(groups) ? groups : [])
    .filter((g) => g && !g.tab)
    .flatMap((g) => (Array.isArray(g.rows) ? g.rows : []))
}

/**
 * 未归类行 → 按「物料类别」原始值分组(供渲染成多个未归类页签)。
 * @returns {Array<{key: string, rows: Array<object>}>} key = 物料类别原文(trim 后,空类别='')
 */
export function orphanGroupsOf(groups) {
  const rows = orphanRowsOf(groups).slice().sort(byIdAsc)
  const byCat = new Map()
  for (const r of rows) {
    const cat = normCode(r && r['物料类别'])
    if (!byCat.has(cat)) byCat.set(cat, [])
    byCat.get(cat).push(r)
  }
  return [...byCat.entries()].map(([key, list]) => ({ key, rows: list }))
}

/** 未归类页签的列:按行自身字段名(没有页签配置可用 —— 这是唯一不丢字段的取法,
 *  与「带入检验要求」的兜底列序同源)。标识列在前,物料类别/主键/审计列剔除。
 *  宽列(方法/标准/内容/要求/说明)给宽一点,否则验收说明这种长文本挤成一团。 */
export function orphanColsOf(rows, { width = 140, wideWidth = 240 } = {}) {
  const LEAD = ['物料编号', '文件编码', '检验依据']
  const seen = []
  for (const r of Array.isArray(rows) ? rows : []) {
    for (const k of Object.keys(r || {})) {
      // __panel 之类是前端内部标记(弹窗给行打的来源面板标签),不是业务列 —— 别渲染出来
      if (!k || k === '物料类别' || k === 'id' || k.startsWith('asp_') || k.startsWith('__')) continue
      if (!seen.includes(k)) seen.push(k)
    }
  }
  const ordered = [...LEAD.filter((k) => seen.includes(k)), ...seen.filter((k) => !LEAD.includes(k))]
  return ordered.map((key) => ({ key, w: /方法|标准|内容|要求|说明/.test(key) ? wideWidth : width }))
}

/**
 * 一行到位:全量行 + 物料编码 → 分组结果
 * @returns {Array<{key: string, tab: object|null, rows: Array<object>}>}
 */
export function lookupReqGroups(rows, materialCode, tabs) {
  return reqGroupsOf(matchReqRowsByMaterial(rows, materialCode), tabs)
}
