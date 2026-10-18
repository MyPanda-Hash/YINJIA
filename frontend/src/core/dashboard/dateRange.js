/**
 * dateRange.js — 看板「时间区间」纯函数(2026-10-16 用户需求:所有看板都能选时间区间看数据)
 *
 * 口径(与后端 DashboardStatsService.Range 对齐):
 *   · 闭区间 [from, to],都是 yyyy-MM-dd 字符串;
 *   · 区间 ≤ 31 天 → 趋势按天分桶,> 31 天 → 按周分桶(桶首=周一);
 *   · 缺省 = 近 30 天(含今天)。
 */

/** 快捷区间(顺序即 UI 顺序) */
export const PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'last7', label: '近 7 天' },
  { key: 'last30', label: '近 30 天' },
  { key: 'lastMonth', label: '上月' },
]

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const at = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const daysBetween = (a, b) => Math.round((at(b) - at(a)) / 86400000) + 1

/** 今天(yyyy-MM-dd);可注入便于测试 */
export function todayStr(now = new Date()) {
  return fmt(now)
}

/** 快捷区间 → {from,to};key 未知时回退「近 30 天」 */
export function presetRange(key, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (key) {
    case 'today': return { from: fmt(today), to: fmt(today) }
    case 'week': {
      const mon = addDays(today, -(today.getDay() === 0 ? 6 : today.getDay() - 1)) // 周一起
      return { from: fmt(mon), to: fmt(today) }
    }
    case 'month': return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) }
    case 'last7': return { from: fmt(addDays(today, -6)), to: fmt(today) }
    case 'lastMonth': {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastEnd = addDays(firstThis, -1)
      return { from: fmt(new Date(lastEnd.getFullYear(), lastEnd.getMonth(), 1)), to: fmt(lastEnd) }
    }
    case 'last30':
    default: return { from: fmt(addDays(today, -29)), to: fmt(today) }
  }
}

/** 默认区间(近 30 天) */
export function defaultRange(now = new Date()) {
  return presetRange('last30', now)
}

/**
 * 区间是否"可解析"(两个合法日期;**不判先后** —— 用户先点结束日后点开始日时是反序,
 * 由 normalizeRange 交换纠正,而不是整段丢掉回退默认值)。
 */
export function isValidRange(range) {
  if (!range || !range.from || !range.to) return false
  const re = /^\d{4}-\d{2}-\d{2}$/
  return re.test(String(range.from).slice(0, 10)) && re.test(String(range.to).slice(0, 10))
}

/** 规范化:非法/反序 ⇒ 回退默认区间;超过 366 天截断(与后端一致) */
export function normalizeRange(range, now = new Date()) {
  if (!isValidRange(range)) return defaultRange(now)
  let { from, to } = range
  if (at(from) > at(to)) { const t = from; from = to; to = t }
  if (daysBetween(from, to) > 366) from = fmt(addDays(at(to), -365))
  return { from: String(from).slice(0, 10), to: String(to).slice(0, 10) }
}

/** 请求参数(后端 /dashboard/stats|/dashboard/rd 用) */
export function rangeQuery(range, now = new Date()) {
  const r = normalizeRange(range, now)
  return { from: r.from, to: r.to }
}

/** 区间天数(含首尾) */
export function rangeDays(range) {
  return daysBetween(range.from, range.to)
}

/** 趋势分桶口径:≤31 天按天,否则按周(与后端一致) */
export function bucketLabel(range) {
  return rangeDays(range) > 31 ? '按周' : '按天'
}

/** 展示文案:2026-09-17 ~ 2026-10-16(30 天) */
export function rangeLabel(range) {
  const d = rangeDays(range)
  return `${range.from} ~ ${range.to}(${d} 天)`
}

/** 区间命中了哪个快捷项;都不是则返回 'custom' */
export function matchPreset(range, now = new Date()) {
  for (const p of PRESETS) {
    const r = presetRange(p.key, now)
    if (r.from === range.from && r.to === range.to) return p.key
  }
  return 'custom'
}
