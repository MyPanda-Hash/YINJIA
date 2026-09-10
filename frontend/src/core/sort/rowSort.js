/**
 * 表格排序比较器(纯函数,无 Vue 依赖)。
 * 口径(2026-09-09 通用规则,明细/主表/报表现共用):
 *  - 字段类型优先(yj_field.dataType):整数/小数/数字 → 按数值;日期/日期时间 → 按时间;
 *    其余(文本/下拉框/参照/是否) → zh-CN 排序(中文=拼音序)。同列一个口径,不逐值猜测。
 *  - 空值(空串/null/undefined)升序降序都排最后。
 *  - 返回排序副本、稳定排序,不改动入参数组、不改行数据(调用方只换渲染顺序)。
 *  - 未提供字段元数据时沿用旧口径(两侧都能当数字才按数字),兼容既有报表调用。
 */

const NUMERIC_TYPES = new Set(['整数', '小数', '数字'])
const DATE_TYPES = new Set(['日期', '日期时间'])

/** 空值判定:null/undefined/空串(纯空白同空) */
export function isBlankValue(value) {
  return value === null || value === undefined || String(value).trim() === ''
}

/** 数值解析:容忍千分位逗号、空白与百分号;解析不出返回 null */
function toNumber(value) {
  const text = String(value).replace(/[,\s]/g, '').replace(/%$/, '')
  if (text === '') return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

/** 时间解析:兼容 2026-09-09 / 2026/9/9 / 带T的 ISO / 带时分秒;解析不出返回 null */
function toTime(value) {
  const text = String(value).trim().replace(/\//g, '-').replace('T', ' ')
  const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ ](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (!m) return null
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0))
}

/** 中文/通用文本比较:zh-CN 排序规则(中文按拼音,英文按字母) */
function compareText(a, b) {
  return String(a).localeCompare(String(b), 'zh-CN')
}

/** 单列比较:类型决定口径,同列一致 */
function compareByField(field, a, b) {
  const type = field && field.dataType ? String(field.dataType) : ''
  if (NUMERIC_TYPES.has(type)) {
    const na = toNumber(a)
    const nb = toNumber(b)
    return na !== null && nb !== null ? na - nb : compareText(a, b)
  }
  if (DATE_TYPES.has(type)) {
    const ta = toTime(a)
    const tb = toTime(b)
    return ta !== null && tb !== null ? ta - tb : compareText(a, b)
  }
  if (type) return compareText(a, b)
  // 无字段元数据:沿用旧报表口径(两侧都能当数字才按数字)
  const na = toNumber(a)
  const nb = toNumber(b)
  return na !== null && nb !== null ? na - nb : compareText(a, b)
}

/**
 * 行排序。行整体移动(字段随行走),字段对位不变。
 * @param {Object[]} rows 原始行(不被修改)
 * @param {{prop:string, order:'asc'|'desc'|'', field?:Object}} sort 排序配置
 * @returns {Object[]} 排序后的新数组(order 为空时返回原顺序副本)
 */
export function sortRows(rows = [], sort = {}) {
  const out = [...rows]
  const prop = sort ? sort.prop : ''
  const order = sort ? sort.order : ''
  if (!prop || (order !== 'asc' && order !== 'desc')) return out
  const field = sort ? sort.field : null
  const dir = order === 'asc' ? 1 : -1
  return out
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row ? left.row[prop] : undefined
      const b = right.row ? right.row[prop] : undefined
      const blankA = isBlankValue(a)
      const blankB = isBlankValue(b)
      if (blankA || blankB) {
        if (blankA && blankB) return left.index - right.index
        return blankA ? 1 : -1 // 空值恒排最后
      }
      const result = compareByField(field, a, b)
      return result !== 0 ? result * dir : left.index - right.index
    })
    .map((item) => item.row)
}

/**
 * 表头点击循环:升 → 降 → 取消。点别的列时由调用方传入新列(单键排序,覆盖前一列)。
 * @returns {{prop:string, order:string}} 下一个排序状态
 */
export function nextSortState(current, prop) {
  if (!prop) return { prop: '', order: '' }
  if (!current || current.prop !== prop || !current.order) return { prop, order: 'asc' }
  if (current.order === 'asc') return { prop, order: 'desc' }
  return { prop: '', order: '' }
}
