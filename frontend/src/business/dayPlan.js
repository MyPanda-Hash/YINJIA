/**
 * 日排产(2026-10-29)纯逻辑。
 *
 * 生产工单(WorkOrderList)与工单排产(WorkOrderBoard)两页共用:
 *   · 表格里的「日期列」:过去只读完成量、今天及以后是可编辑的计划量;
 *   · 「按完工日期均摊」= 把剩余数量均摊到 起点~完工日 的每一天(除不尽余数给最后一天)。
 *
 * 只放可单测的纯函数(接口调用见 business/dayPlanApi.js),组件只管状态与渲染,
 * 保证两页行为完全一致。
 */

/** 均匀分摊:总数量 total 从 start 到 due(含)逐日;返回 { 'YYYY-MM-DD': 数量 } */
export function buildSplit(total, start, due) {
  const t = Number(total) || 0
  const s = parseDate(start)
  const e = parseDate(due)
  if (t <= 0 || !s || !e || e < s) return {}
  const days = []
  const cur = new Date(s)
  while (cur <= e) {
    days.push(fmtDate(cur))
    cur.setDate(cur.getDate() + 1)
  }
  const n = days.length
  const out = {}
  if (Number.isInteger(t)) {
    // 整数件数优先按整数排:每天 floor(t/n),余数全部给最后一天(现场按件报,不出现小数)
    const base = Math.floor(t / n)
    days.forEach((d, i) => { out[d] = i === n - 1 ? t - base * (n - 1) : base })
    return out
  }
  // 非整数(按重量/长度等):保留 4 位小数(与后端 decimal(18,4) 同精度),余数给最后一天
  const base = Math.round((t / n) * 10000) / 10000
  days.forEach((d, i) => {
    out[d] = i === n - 1 ? Math.round((t - base * (n - 1)) * 10000) / 10000 : base
  })
  return out
}

/** 对比「原计划 / 当前计划」,返回改动过的格子(含清空:数量 0) */
export function diffPlan(original, current, dates) {
  const out = []
  for (const d of dates || []) {
    const a = Number((original || {})[d] || 0)
    const b = Number((current || {})[d] || 0)
    if (a !== b) out.push({ 日期: d, 数量: b })
  }
  return out
}

/** 数量显示:0/空显示空白(日期格没排就是空的,免得满屏 0) */
export function qtyText(v) {
  const n = Number(v || 0)
  return n ? n.toFixed(2).replace(/\.?0+$/, '') : ''
}

/** 日期是否属于"过去"(不含今天):过去格只读显示完成量 */
export function isPast(date, today) {
  return !!date && !!today && date < today
}

function parseDate(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function fmtDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
