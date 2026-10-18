/**
 * point_date 期初口径 —— 修正版
 *   · stock_number 为空 ⇒ 用 stock_id 建映射(stock_id → 编码/名称)
 *   · 每页固定只回 100 行 ⇒ 必须按 100 翻页
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const P = '/jdy/v2/scm/inventory'
const PAGE = 100

async function fetchAll(date, label) {
  const rows = []
  let count = null
  for (let page = 1; page <= 100; page++) {
    const r = await kingdeeTryGet(cfg, token, P, { page: String(page), page_size: String(PAGE), point_date: date })
    if (!r.ok) { console.log(`  ❌ ${label} p${page}: ${r.error.slice(0, 100)}`); break }
    count = r.data.count ?? r.data.total
    const rs = r.data.rows || []
    rows.push(...rs)
    if (rs.length < PAGE) break
    await sleep(100)
  }
  console.log(`  [${label}] 声明 ${count} · 实拉 ${rows.length} 行`)
  return { rows, count }
}

// stock_id → 编码/名称(从现存量接口拿,它同时给出 stock_id 与 stock_number)
const ims = []
for (let page = 1; page <= 30; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  if (!r.ok) break
  const rs = r.data.rows || []
  ims.push(...rs)
  if (rs.length < 500) break
  await sleep(90)
}
const stkMap = new Map()
for (const r of ims) if (r.stock_id) stkMap.set(String(r.stock_id), { number: r.stock_number, name: r.stockid_name })
console.log(`现存量 ${ims.length} 行 · 仓库映射 ${stkMap.size} 个`)

console.log('\n========== 拉 point_date 各时点 ==========')
const aug = await fetchAll('2026-08-31', '2026-08-31')
const today = await fetchAll('2026-10-19', '2026-10-19(今天)')

const key = (w, c, l) => `${w}|${c}|${l || ''}`
function normalize(rows) {
  const m = new Map()
  for (const r of rows) {
    const stk = stkMap.get(String(r.stock_id)) || {}
    const k = key(r.material_number, stk.number || r.stock_number || String(r.stock_id), r.batch_no)
    m.set(k, (m.get(k) || 0) + Number(r.qty || 0))
  }
  return m
}

const augMap = normalize(aug.rows)
const todayMap = normalize(today.rows)
const imsMap = new Map()
for (const r of ims) {
  const k = key(r.material_number, r.stock_number, r.batch_no)
  imsMap.set(k, (imsMap.get(k) || 0) + Number(r.qty || 0))
}

let same = 0, diff = 0, onlyT = 0, onlyI = 0
const td = []
for (const [k, v] of todayMap) {
  const i = imsMap.get(k)
  if (i === undefined) { onlyT++; continue }
  if (Math.abs(i - v) < 0.0001) same++
  else { diff++; if (td.length < 8) td.push({ k, point: v, ims: i }) }
}
for (const k of imsMap.keys()) if (!todayMap.has(k)) onlyI++
console.log(`\n③ point_date=今天 vs 现存量:一致 ${same} / 数量不同 ${diff} / 仅今天有 ${onlyT} / 仅ims有 ${onlyI}`)
for (const d of td) console.log(`    ${d.k}  point=${d.point} ims=${d.ims}`)

const bRows = JSON.parse(readFileSync(new URL('./_out/opening-0831.json', import.meta.url), 'utf8'))
const bMap = new Map(bRows.map((r) => [key(r.wzdm, r.ckdm, r.lot), r.qty]))
let bSame = 0, bDiff = 0, bOnly = 0, bOnlyB = 0
const bDiffs = []
for (const [k, v] of augMap) {
  const b = bMap.get(k)
  if (b === undefined) { bOnly++; continue }
  if (Math.abs(b - v) < 0.0001) bSame++
  else { bDiff++; if (bDiffs.length < 12) bDiffs.push({ k, point: v, B: b }) }
}
for (const k of bMap.keys()) if (!augMap.has(k)) bOnlyB++
console.log(`\n④ point_date(8/31) vs 倒挤B:point键 ${augMap.size} / B键 ${bMap.size}`)
console.log(`   一致 ${bSame} / 不同 ${bDiff} / 仅point有 ${bOnly} / 仅B有 ${bOnlyB}`)
for (const d of bDiffs) console.log(`    ${d.k}  point=${d.point}  B=${d.B}`)
const sumAug = [...augMap.values()].reduce((s, v) => s + v, 0)
const sumB = bRows.reduce((s, r) => s + r.qty, 0)
const sumT = [...todayMap.values()].reduce((s, v) => s + v, 0)
console.log(`\n数量合计: point(8/31)=${sumAug.toFixed(2)}  倒挤B=${sumB.toFixed(2)}  point(今天)=${sumT.toFixed(2)}  现存量=${[...imsMap.values()].reduce((s,v)=>s+v,0).toFixed(2)}`)

mkdirSync(new URL('./_out/', import.meta.url), { recursive: true })
const outRows = aug.rows.map((r) => {
  const stk = stkMap.get(String(r.stock_id)) || {}
  return { wzdm: r.material_number, name: r.material_name, ckdm: stk.number || String(r.stock_id),
    ckName: stk.name || r.stock_name, lot: r.batch_no || null, qty: Number(r.qty || 0) }
}).filter((r) => Math.abs(r.qty) > 0.00001)
writeFileSync(new URL('./_out/pointdate-20260831.json', import.meta.url), JSON.stringify(outRows), 'utf8')
console.log(`\n[产物] _out/pointdate-20260831.json (${outRows.length} 行非零) · 负值 ${outRows.filter((r) => r.qty < 0).length} 行`)
