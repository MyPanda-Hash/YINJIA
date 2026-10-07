/**
 * sheetDateCells.js — 实验室记录表「日期/时间格」的控件种类与取值归一(纯函数,可在 node --test 下断言)
 *
 * 背景(2026-10-07):
 *   这批纸面记录表(recordSheetConfigs 的 11 张)里,日期/时间格历史上一律是 `el-input` 手填,
 *   值是**从 Excel 抄过来的自由文本**:`2026.09.04`、`2026/9/27 15:54:39`、`09:00-10:00`、
 *   `15.00-16.00`,甚至 `45926`(Excel 日期序列)。而服务器上部分列是 `datetime`
 *   (见 tools/migrate-server-parity-20260928.sql:102),接口下发的是 Jackson 的
 *   `2026-10-06T16:00:00.000+00:00`——这种带时区偏移的串**回传到 datetime 列会报 241**。
 *   ⇒ 控件要显示得出来、回传要规范,靠的就是这里的归一。
 *
 * 两条硬规矩:
 *   ① 归一失败**不丢数据**:认不出来返回空串(控件显示为空),调用方**不回写**,
 *      库里原值照旧(例如 `待定`、`45926` 之外的乱填值)。
 *   ② 只读显示认不出来就**原样显示**,不把 `待定` 显示成空白。
 */

/** 与通用面板 isDateField 同一份中文词表(见 PanelxList.vue:4803),避免两处口径漂移 */
export function cellKindOf(dataType) {
  switch (String(dataType ?? '').trim()) {
    case '日期': return 'date'
    case '日期时间': return 'datetime'
    case '时间': return 'time'
    case '时间区间': return 'time-range'
    default: return 'text'
  }
}

/** Excel 1900 日期序列起点(序列 1 = 1900-01-01,含 1900 闰年 bug 的通用修正) */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30)
/** 认定成序列号的区间:1954-09 ~ 2064-06。范围外当普通数字,不硬掰成日期 */
const SERIAL_MIN = 20000
const SERIAL_MAX = 60000

const pad2 = (n) => String(n).padStart(2, '0')

/** 年月日 → 'YYYY-MM-DD';非法(13 月/2 月 30 日/非闰年 2-29)返回空串 */
function isoDate(y, m, d) {
  if (!(y >= 1900 && y <= 2999) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return ''
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return ''
  return `${y}-${pad2(m)}-${pad2(d)}`
}

/** 5 位纯数字按 Excel 序列解(实测:45926 → 2025-09-26) */
function serialToDate(n) {
  const days = Math.floor(n)
  if (days < SERIAL_MIN || days > SERIAL_MAX) return ''
  const dt = new Date(EXCEL_EPOCH_UTC + days * 86400000)
  return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

const DATE_HEAD = /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})/
const ISO_TIME = /[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/
const CLOCK = /^(\d{1,2})[:.](\d{1,2})(?::(\d{1,2}))?$/
const RANGE_SPLIT = /\s*[-~～—－]\s*/

const rawText = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** 任意历史写法 → 'YYYY-MM-DD';认不出来返回 '' */
export function toDateText(v) {
  if (typeof v === 'number') return serialToDate(v)
  const s = rawText(v)
  if (!s) return ''
  if (/^\d+$/.test(s)) {
    if (s.length === 8) return isoDate(+s.slice(0, 4), +s.slice(4, 6), +s.slice(6, 8)) // 20261007
    if (s.length === 5) return serialToDate(+s)
    return '' // 6 位的 '260927' 这种年份缩写不当日期认
  }
  const m = DATE_HEAD.exec(s)
  if (!m) return ''
  return isoDate(+m[1], +m[2], +m[3])
}

/** 取时间三段(秒可缺):ISO 带 T 的串或裸钟点串,取不到/越界返回 null */
function parseClock(v) {
  const s = rawText(v)
  if (!s) return null
  const m = ISO_TIME.exec(s) || CLOCK.exec(s) // 2026-09-27T08:23:42 / 09:00 / 9:5 / 09:00:00 / 15.00
  if (!m) return null
  const h = +m[1]
  const mi = +m[2]
  const sec = m[3] === undefined ? 0 : +m[3]
  if (!(h >= 0 && h <= 23) || !(mi >= 0 && mi <= 59) || !(sec >= 0 && sec <= 59)) return null
  return { h, mi, sec }
}

/** 时间部分 → 'HH:mm';认不出来返回 ''(纯日期串没有时间部分,返回空) */
export function toTimeText(v) {
  const c = parseClock(v)
  return c ? `${pad2(c.h)}:${pad2(c.mi)}` : ''
}

/** 'YYYY-MM-DD HH:mm:ss'(「日期时间」类字段用;只有日期部分时补 00:00:00) */
export function toDateTimeText(v) {
  const d = toDateText(v)
  if (!d) return ''
  const c = parseClock(v)
  const t = c ? `${pad2(c.h)}:${pad2(c.mi)}:${pad2(c.sec)}` : '00:00:00'
  return `${d} ${t}`
}

/** 区间文本 → ['HH:mm','HH:mm'] | null(认不出来返回 null,调用方不写回) */
export function parseTimeRange(v) {
  const s = rawText(v)
  if (!s) return null
  const parts = s.split(RANGE_SPLIT)
  if (parts.length < 2) return null
  const a = toTimeText(parts[0])
  const b = toTimeText(parts[parts.length - 1])
  if (!a || !b) return null
  return [a, b]
}

/** 控件回值(['HH:mm','HH:mm']) → 落库文本 'HH:mm-HH:mm';不完整返回 '' */
export function joinTimeRange(arr) {
  if (!Array.isArray(arr) || arr.length < 2) return ''
  const a = toTimeText(arr[0])
  const b = toTimeText(arr[1])
  if (!a || !b) return ''
  return `${a}-${b}`
}

/** 只读格显示文本:按种类归一,认不出来原样显示(绝不显示成空白) */
export function cellText(kind, v) {
  const raw = rawText(v)
  if (!raw) return ''
  switch (kind) {
    case 'date': {
      const d = toDateText(v)
      return d || raw
    }
    case 'datetime': {
      const d = toDateTimeText(v)
      return d || raw
    }
    case 'time': {
      const t = toTimeText(v)
      return t || raw
    }
    case 'time-range': {
      const r = parseTimeRange(v)
      return r ? joinTimeRange(r) : raw
    }
    default:
      return raw
  }
}

/**
 * 库里值 → 控件绑定值。
 * 归不出来时返回空串 / null(**只影响控件显示**):调用方一律绑定 `:model-value`(不是 v-model),
 * 用户不点选就不回写 ⇒ `待定`、`333` 这类认不出来的历史值不会被清掉。
 */
export function controlValue(kind, v) {
  switch (kind) {
    case 'date': return toDateText(v)
    case 'datetime': return toDateTimeText(v)
    case 'time': return toTimeText(v)
    case 'time-range': return parseTimeRange(v)
    default: return v === null || v === undefined ? '' : v
  }
}

/** 控件回值 → 落库文本:日期类直接收串;区间合成 'HH:mm-HH:mm'(不完整视为清空) */
export function controlToStored(kind, picked) {
  if (kind === 'time-range') return joinTimeRange(picked)
  return picked === null || picked === undefined ? '' : String(picked)
}
