/**
 * prodDocSearch.js — 产品文件列表(RD_PROD_DOCLIST)**矩阵行**的搜索口径(纯函数)。
 *
 * 【为什么需要它】该面板是「单单据 + 矩阵」:库里只有 1 张单据(PDL-0001),
 * 真正的内容是表格里的**产品行**(产品编号 × 4 个文件 × 状态)。侧栏的
 * 「模糊搜索 / 查询单据 / 单据预览」原先都是对那 1 张单据做**文档查询** ——
 * 于是用户看到的就是「搜索在这个面板不可用」(2026-09-30 用户反馈)。
 * 现在这三个入口在该面板改为**对矩阵行筛选**(客户端,不跑单据查询),判定集中在这里。
 *
 * 字段口径(与界面上那个字段下拉一一对应):
 *   · 产品编号 / 是否受控 / 受控日期 → 该列内容包含关键字(忽略大小写)
 *   · 状态（任一文件）               → 4 个文件里**任一**状态包含关键字
 *                                     (填「未开发」= 找还有文件没做的产品)
 *   · 任意字段(ALL_FIELDS)           → 以上任一命中即算命中
 * 多条件 AND;同字段多行时后一行覆盖前一行(与文书侧栏 buildFuzzyQuery 同口径)。
 */
import { ALL_FIELDS } from '../search/fuzzyQuery.js'

/** 「状态（任一文件）」这个虚拟字段名(不是表列,是横跨 4 个状态格的检索口径) */
export const PROD_DOC_STATUS_FIELD = '状态（任一文件）'

/** 字段下拉顺序(产品编号在最前:设计原表就写着「可通过产品编号直接搜索」) */
export const PROD_DOC_FIELD_OPTIONS = ['产品编号', '是否受控', '受控日期', PROD_DOC_STATUS_FIELD]

/** 单元格 → 可比文本 */
function txt(v) {
  return v === undefined || v === null ? '' : String(v)
}

/** a 是否包含 b(忽略大小写) */
function has(a, b) {
  const s = txt(a).toLowerCase()
  const k = txt(b).toLowerCase().trim()
  return !!k && s.includes(k)
}

/** 某行某面板的状态(与 ProdDocListSheet.statusOf 同口径) */
function statusOf(row, col) {
  const cells = row && row.cells ? row.cells : null
  if (!cells) return ''
  const v = cells[col.panelCode]
  return v === undefined || v === null ? '' : String(v)
}

/**
 * 条件行(字段+内容)→ 生效条件。空行忽略;有值即 valid;同字段后者覆盖前者。
 * @param {{field:string,value:string}[]} rows
 * @returns {{conditions:{field:string,value:string}[], valid:boolean}}
 */
export function buildProdDocFilter(rows = []) {
  const byField = new Map()
  for (const r of rows || []) {
    const field = r && r.field ? String(r.field).trim() : ''
    const value = r && r.value !== undefined && r.value !== null ? String(r.value).trim() : ''
    if (!field || !value) continue
    byField.set(field, value) // 同字段后者覆盖前者
  }
  const conditions = [...byField.entries()].map(([field, value]) => ({ field, value }))
  return { conditions, valid: conditions.length > 0 }
}

/** 单行是否命中全部条件(AND) */
export function matchProdDocRow(row, columns, filter) {
  const conds = filter && Array.isArray(filter.conditions) ? filter.conditions : []
  if (!conds.length) return true
  const cols = Array.isArray(columns) ? columns : []
  return conds.every(({ field, value }) => {
    if (field === PROD_DOC_STATUS_FIELD) return cols.some((c) => has(statusOf(row, c), value))
    if (field === ALL_FIELDS) {
      return has(row?.产品编号, value)
        || has(row?.['是否受控'], value)
        || has(row?.['受控日期'], value)
        || cols.some((c) => has(statusOf(row, c), value))
    }
    return has(row?.[field], value)
  })
}

/**
 * 按条件过滤矩阵行。**没有生效条件时原样返回**(不是清空)。
 * @param {object[]} rows
 * @param {{panelCode:string,panelName:string}[]} columns
 * @param {{conditions:{field:string,value:string}[], valid:boolean}|null} filter
 */
export function filterProdDocRows(rows, columns, filter) {
  const list = Array.isArray(rows) ? rows : []
  if (!filter || !filter.valid) return list
  return list.filter((r) => matchProdDocRow(r, columns, filter))
}
