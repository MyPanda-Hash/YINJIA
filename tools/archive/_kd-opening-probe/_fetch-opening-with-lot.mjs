/**
 * 重取 8/31 期初 —— 带批号(include_batch_kf_period=true)
 *
 * 踩坑(2026-10-19):/jdy/v2/scm/inventory 默认**不返回批号**(batch_no 恒空),
 * 必须显式传 include_batch_kf_period=true 才按批次拆行。
 * 若不传,期初全部变成"无批号行",而 MES 9/1 后的出库扣的是 PC0000 ⇒ 批号永远对不上,
 * 导入后负结存会从 431 涨到 785。
 *
 * 同时验证:include_batch_kf_period=true 时,point_date=今天 是否仍与现存量逐键一致。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PAGE = 100

async function fetchPoint(date, withBatch) {
  const rows = []
  let count = null
  for (let page = 1; page <= 100; page++) {
    const params = { page: String(page), page_size: String(PAGE), point_date: date }
    if (withBatch) params.include_batch_kf_period = 'true'
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inventory', params)
    if (!r.ok) { console.log(`  ❌ ${date} p${page}: ${r.error.slice(0, 90)}`); break }
    count = r.data.count ?? r.data.total
    const rs = r.data.rows || []
    rows.push(...rs)
    if (rs.length < PAGE) break
    await sleep(90)
  }
  return { rows, count }
}

// 仓库 id → 编码(该接口的 stock_number 恒空)
const stk = new Map()
for (let page = 1; page <= 30; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  if (!r.ok) break
  const rs = r.data.rows || []
  for (const x of rs) if (x.stock_id) stk.set(String(x.stock_id), { num: x.stock_number, name: x.stockid_name })
  if (rs.length < 500) break
  await sleep(80)
}
console.log(`仓库映射 ${stk.size} 个`)

console.log('\n① 8/31 期初(带批号)…')
const aug = await fetchPoint('2026-08-31', true)
console.log(`   ${aug.rows.length}/${aug.count} 行`)
const withLot = aug.rows.filter((r) => r.batch_no)
console.log(`   有批号 ${withLot.length} 行 · 无批号 ${aug.rows.length - withLot.length} 行 · PC0000 ${aug.rows.filter((r) => r.batch_no === 'PC0000').length} 行`)

console.log('\n② 今天(带批号)vs 现存量,自洽校验…')
const today = await fetchPoint('2026-10-19', true)
console.log(`   ${today.rows.length}/${today.count} 行`)

const key = (w, c, l) => `${w}|${c}|${l || ''}`
const norm = (r) => {
  const s = stk.get(String(r.stock_id)) || {}
  return { wzdm: r.material_number, ckdm: s.num || r.stock_number || String(r.stock_id),
    ckName: s.name || r.stock_name, lot: r.batch_no || null, qty: Number(r.qty || 0) }
}
const sum = (rows) => {
  const m = new Map()
  for (const r of rows) { const n = norm(r); const k = key(n.wzdm, n.ckdm, n.lot); m.set(k, (m.get(k) || 0) + n.qty) }
  return m
}
const tMap = sum(today.rows)
const iMap = new Map()
{
  let ims = []
  for (let page = 1; page <= 30; page++) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
    if (!r.ok) break
    ims.push(...(r.data.rows || []))
    if ((r.data.rows || []).length < 500) break
    await sleep(80)
  }
  for (const r of ims) { const k = key(r.material_number, r.stock_number, r.batch_no); iMap.set(k, (iMap.get(k) || 0) + Number(r.qty || 0)) }
  console.log(`   现存量 ${ims.length} 行`)
}
let same = 0, diff = 0, onlyT = 0, onlyI = 0
const dd = []
for (const [k, v] of tMap) {
  const i = iMap.get(k)
  if (i === undefined) { onlyT++; continue }
  if (Math.abs(i - v) < 0.0001) same++; else { diff++; if (dd.length < 8) dd.push({ k, point: v, ims: i }) }
}
for (const k of iMap.keys()) if (!tMap.has(k)) onlyI++
console.log(`   一致 ${same} / 数量不同 ${diff} / 仅今天有 ${onlyT} / 仅现存量有 ${onlyI}`)
for (const d of dd) console.log(`     ${d.k}  point=${d.point}  ims=${d.ims}`)

// 落盘
const out = aug.rows.map(norm).filter((r) => Math.abs(r.qty) > 0.00001)
writeFileSync(new URL('./_out/opening-A-0831-lot.json', import.meta.url), JSON.stringify(out), 'utf8')
const sumAug = out.reduce((s, r) => s + r.qty, 0)
console.log(`\n[产物] _out/opening-A-0831-lot.json  ${out.length} 行 / 合计 ${sumAug.toFixed(2)} / 负值 ${out.filter((r) => r.qty < 0).length}`)
