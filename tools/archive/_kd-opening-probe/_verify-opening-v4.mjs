/**
 * 期初(2026-08-31 结存)可行性验证 v4 —— 修正分页与行语义
 *
 * ── 关键事实(2026-10-19 实测,真实账套 359797)──
 * ① 日期窗口跨度上限约 1 年,超了**静默回 0 条** ⇒ 必须按月
 * ② 每页实际只回 100 行,即使 page_size=2000 也只回 100(首页例外地回 page_size 条)
 *    ⇒ **必须按 100/页 翻页**,不能相信 count 之外的假设
 * ③ 行语义:
 *    · 有 bill_no + stock_number + bill_date ⇒ 真实收发分录 → 累加用这些
 *    · 无 bill_no(仓库空,只有 remain_base_qty) ⇒ 期间汇总行 → **排除**
 *    · 仓库为空但**有** bill_no + 数量 ⇒ 真实收发但无仓库维度(需单列统计)
 *
 * ── 期初两种算法 ──
 *   A 正向累加 = Σ(2024-01~2026-08 真实收发) 入−出
 *   B 倒挤     = 现存量 − Σ(2026-09~今 真实收发) 入−出
 *   A≈B 才可信。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const DB = process.env.PROBE_DB || 'HSDZ_MES'
const PAGE = 100
const CONC = 8
const START_YM = '2025-01'

const out = []
const log = (s = '') => { out.push(s); console.log(s) }
const months = (fromYm, toYm) => {
  const r = []
  let [y, m] = fromYm.split('-').map(Number)
  const [ty, tm] = toYm.split('-').map(Number)
  while (y < ty || (y === ty && m <= tm)) { r.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++ } }
  return r
}

async function fetchMonth(ym) {
  const s = `${ym}-01`
  const e = `${ym}-${new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()}`
  const first = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_detail',
    { page: '1', page_size: String(PAGE), start_date: s, end_date: e })
  if (!first.ok) return { ym, rows: [], count: 0 }
  const count = first.data.count ?? first.data.total ?? 0
  const pages = Math.ceil(count / PAGE)
  const rows = [...(first.data.rows || [])]
  for (let b = 2; b <= pages; b += CONC) {
    const batch = []
    for (let p = b; p < Math.min(b + CONC, pages + 1); p++) {
      batch.push(kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_detail',
        { page: String(p), page_size: String(PAGE), start_date: s, end_date: e }))
    }
    for (const r of await Promise.all(batch)) if (r.ok) rows.push(...(r.data.rows || []))
  }
  return { ym, rows, count }
}

async function fetchMonths(fromYm, toYm, label) {
  const ms = months(fromYm, toYm)
  console.log(`\n=== ${label}:${ms.length} 个月 ===`)
  const all = []
  for (let i = 0; i < ms.length; i += 3) {
    for (const r of await Promise.all(ms.slice(i, i + 3).map(fetchMonth))) {
      all.push(...r.rows)
      const flag = r.rows.length === r.count ? '' : ` ⚠声明${r.count}/实拉${r.rows.length}`
      process.stdout.write(`  ${r.ym}:${r.rows.length}${flag}`)
    }
  }
  console.log(`\n  合计 ${all.length} 行`)
  return all
}

const key = (w, c, l) => `${w}|${c}|${l || ''}`
function agg(rows) {
  const m = new Map()
  const stat = { 真实收发: 0, 汇总行: 0, 无仓库真实收发: 0 }
  let noWhQty = 0
  for (const r of rows) {
    const hasQty = Number(r.in_qty || 0) !== 0 || Number(r.out_qty || 0) !== 0
    if (!r.bill_no) { stat.汇总行++; continue }
    if (!r.stock_number) { stat.无仓库真实收发++; noWhQty += Number(r.in_qty || 0) - Number(r.out_qty || 0); continue }
    if (!hasQty) continue
    stat.真实收发++
    const k = key(r.material_number, r.stock_number, r.batch_no)
    const cur = m.get(k) || { wzdm: r.material_number, name: r.material_name, ckdm: r.stock_number,
      ckName: r.stock_name, lot: r.batch_no || null, inQty: 0, outQty: 0, inCost: 0 }
    cur.inQty += Number(r.in_qty || 0)
    cur.outQty += Number(r.out_qty || 0)
    cur.inCost += Number(r.in_cost || 0)
    m.set(k, cur)
  }
  return { map: m, stat, noWhQty }
}

console.log(`========== 拉金蝶收发明细:期初区间 ${START_YM} ~ 2026-08 ==========`)
const beforeRows = await fetchMonths(START_YM, '2026-08', '期初区间')
console.log('========== 拉金蝶收发明细:本期 2026-09 ~ 2026-12 ==========')
const afterRows = await fetchMonths('2026-09', '2026-12', '本期区间')

console.log('========== 金蝶现存量 ==========')
const inv = []
for (let page = 1; page <= 30; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  if (!r.ok) { console.log('  失败:', r.error.slice(0, 120)); break }
  const rs = r.data.rows || []
  inv.push(...rs)
  if (rs.length < 500) break
}
console.log(`  现存量 ${inv.length} 行`)

const Ab = agg(beforeRows), As = agg(afterRows)
log()
log('# 期初(2026-08-31 结存)可行性验证 v4')
log()
log('## 行语义统计')
log()
log(`- 期初区间行 ${beforeRows.length}:真实收发 ${Ab.stat.真实收发} / 汇总行 ${Ab.stat.汇总行} / 无仓库收发 ${Ab.stat.无仓库真实收发}(净 ${Ab.noWhQty.toFixed(2)})`)
log(`- 本期区间行 ${afterRows.length}:真实收发 ${As.stat.真实收发} / 汇总行 ${As.stat.汇总行} / 无仓库收发 ${As.stat.无仓库真实收发}(净 ${As.noWhQty.toFixed(2)})`)

const kd = new Map()
for (const r of inv) {
  const k = key(r.material_number, r.stock_number, r.batch_no)
  const cur = kd.get(k) || { wzdm: r.material_number, name: r.material_name, ckdm: r.stock_number,
    ckName: r.stockid_name, lot: r.batch_no || null, qty: 0 }
  cur.qty += Number(r.qty || 0)
  kd.set(k, cur)
}

const opA = new Map()
for (const [k, v] of Ab.map) opA.set(k, { ...v, qty: v.inQty - v.outQty })
const opB = new Map()
for (const [k, v] of kd) {
  const n = As.map.get(k)
  opB.set(k, { ...v, qty: v.qty - (n ? n.inQty - n.outQty : 0) })
}
for (const [k, v] of As.map) if (!opB.has(k)) opB.set(k, { ...v, qty: -(v.inQty - v.outQty) })

const sumQ = (m) => [...m.values()].reduce((s, x) => s + Number(x.qty || 0), 0)
const negC = (m) => [...m.values()].filter((x) => x.qty < -0.0001).length

log()
log('## 一、两种算法交叉校验')
log()
log('| 口径 | 键数 | 期初数量合计 | 为负的键 |')
log('|---|---:|---:|---:|')
log(`| **A 正向累加**(${START_YM}~2026-08) | ${opA.size} | ${sumQ(opA).toFixed(4)} | ${negC(opA)} |`)
log(`| B 倒挤(现存量 − 9/1后) | ${opB.size} | ${sumQ(opB).toFixed(4)} | ${negC(opB)} |`)
log()
let same = 0
const diffs = []
for (const [k, a] of opA) {
  const b = opB.get(k)
  if (b && Math.abs(a.qty - b.qty) < 0.0001) same++
  else diffs.push({ k, A: a.qty, B: b ? b.qty : null })
}
let onlyB = 0
for (const k of opB.keys()) if (!opA.has(k)) onlyB++
log(`**A vs B**:一致 **${same}** / 不一致 ${diffs.length} / 仅B有 ${onlyB}`)

let ok = 0
const bad = []
for (const [k, v] of kd) {
  const a = opA.get(k), n = As.map.get(k)
  const calc = (a ? a.qty : 0) + (n ? n.inQty - n.outQty : 0)
  if (Math.abs(calc - v.qty) < 0.0001) ok++
  else bad.push({ k, kd: v.qty, op: a ? a.qty : 0, net: n ? n.inQty - n.outQty : 0 })
}
log()
log('## 二、闭环校验(金蝶侧):期初A + 9/1后真实收发 = 现存量')
log()
log(`- 现存量键 ${kd.size} · **一致 ${ok}** · 不一致 ${bad.length}`)
if (bad.length) {
  bad.sort((x, y) => Math.abs((y.op + y.net) - y.kd) - Math.abs((x.op + x.net) - x.kd))
  log()
  log('| 键 | 现存量 | 期初A | 本期净额 | 差额 |')
  log('|---|---:|---:|---:|---:|')
  for (const b of bad.slice(0, 12)) log(`| \`${b.k}\` | ${b.kd} | ${b.op.toFixed(2)} | ${b.net.toFixed(2)} | ${(b.op + b.net - b.kd).toFixed(2)} |`)
}
// 倒挤口径必然闭环,验证实现
let okB = 0
for (const [k, v] of opB) {
  const n = As.map.get(k)
  if (Math.abs(v.qty + (n ? n.inQty - n.outQty : 0) - (kd.get(k)?.qty ?? 0)) < 0.0001) okB++
}
log()
log(`> 倒挤口径自检:B 键 ${opB.size} 中闭环 ${okB}(预期 = 全部)`)
log(`> 说明:倒挤口径只受**已知该拉哪些单据**影响;正向口径还要求**历史单据齐全**。`)

mkdirSync(new URL('./_out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_out/opening-feasibility.md', import.meta.url), out.join('\n'), 'utf8')
const rowsOut = [...opB.values()].filter((x) => Math.abs(x.qty) > 0.00001)
  .map((x) => ({ wzdm: x.wzdm, name: x.name, ckdm: x.ckdm, ckName: x.ckName, lot: x.lot, qty: Number(x.qty.toFixed(4)),
    qtyA: Number(((opA.get(key(x.wzdm, x.ckdm, x.lot)) || {}).qty ?? 0).toFixed(4)) }))
writeFileSync(new URL('./_out/opening-0831.json', import.meta.url), JSON.stringify(rowsOut), 'utf8')
console.log('\n[产物] _out/opening-feasibility.md · _out/opening-0831.json')
