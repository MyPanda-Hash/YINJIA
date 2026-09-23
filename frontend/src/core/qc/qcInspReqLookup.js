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
 * @returns {Array<{key: string, tab: object|null, rows: Array<object>}>}
 */
export function reqGroupsOf(matched) {
  const list = Array.isArray(matched) ? matched : []
  const groups = []
  const used = new Set()
  for (const tab of qcInspReqTabs) {
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

/**
 * 一行到位:全量行 + 物料编码 → 分组结果
 * @returns {Array<{key: string, tab: object|null, rows: Array<object>}>}
 */
export function lookupReqGroups(rows, materialCode) {
  return reqGroupsOf(matchReqRowsByMaterial(rows, materialCode))
}
