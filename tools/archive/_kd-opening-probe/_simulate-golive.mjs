/**
 * 验证用户设想:「上线当天库存记录为期初,之后的单据流水就能正常吗?」
 *
 * 模拟:取金蝶 D0 当天现存量当期初,然后看 D0 之后的真实单据流水在 MES 里能不能自洽。
 * 关键检查:出库行的批号,是否都能在期初里找到对应的批次?
 */
import { readFileSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PAGE = 100
const key = (w, c, l) => `${w}|${c}|${l || ''}`

async function fetchPoint(date) {
  const rows = []
  for (let page = 1; page <= 100; page++) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inventory',
      { page: String(page), page_size: String(PAGE), point_date: date, include_batch_kf_period: 'true' })
    if (!r.ok) break
    const rs = r.data.rows || []
    rows.push(...rs)
    if (rs.length < PAGE) break
    await sleep(90)
  }
  return rows
}
// stock_id → 仓库编码
const stk = new Map()
{
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: '1', page_size: '500' })
  for (const x of (r.data?.rows || [])) if (x.stock_id) stk.set(String(x.stock_id), x.stock_number)
  for (let p = 2; p <= 10; p++) {
    const rr = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(p), page_size: '500' })
    if (!rr.ok) break
    const rs = rr.data.rows || []
    for (const x of rs) if (x.stock_id) stk.set(String(x.stock_id), x.stock_number)
    if (rs.length < 500) break
    await sleep(80)
  }
}
const norm = (r) => ({ wzdm: r.material_number, ckdm: stk.get(String(r.stock_id)) || r.stock_number || String(r.stock_id),
  lot: r.batch_no || null, qty: Number(r.qty || 0) })

// 取某月的真实收发(有单据号的)
async function fetchMonth(ym) {
  const s = `${ym}-01`
  const e = `${ym}-${new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()}`
  const rows = []
  for (let page = 1; page <= 200; page++) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_detail',
      { page: String(page), page_size: String(PAGE), start_date: s, end_date: e })
    if (!r.ok) break
    const rs = r.data.rows || []
    rows.push(...rs)
    if (rs.length < PAGE) break
    await sleep(45)
  }
  return rows.filter((r) => r.bill_no && r.stock_number && (Number(r.in_qty) || Number(r.out_qty)))
}

// 场景:D0 = 2026-09-01(上线当天的前一个时点)
const D0 = '2026-08-31'
console.log(`=== 假设上线日 = 2026-09-01,D0 = ${D0}(取这一天结存当期初)===\n`)

const openRows = await fetchPoint(D0)
const open = new Map()
for (const r of openRows) { const n = norm(r); const k = key(n.wzdm, n.ckdm, n.lot); open.set(k, (open.get(k) || 0) + n.qty) }
console.log(`① 期初(金蝶 ${D0} 结存):${open.size} 个 (物料,仓库,批号) 键`)

// D0 之后的真实收发
const after = [...await fetchMonth('2026-09'), ...await fetchMonth('2026-10')]
const outRows = after.filter((r) => Number(r.out_qty))
const inRows = after.filter((r) => Number(r.in_qty))
console.log(`② D0 之后真实收发:入库 ${inRows.length} 行 / 出库 ${outRows.length} 行`)

// 关键检查:出库行的键,期初里有没有"同键且有正余额"
let outWithLot = 0, outNoLot = 0
let hitInOpening = 0, missInOpening = 0
const missSample = []
for (const r of outRows) {
  const k = key(r.material_number, r.stock_number, r.batch_no)
  if (!r.batch_no) outNoLot++; else outWithLot++
  const v = open.get(k)
  if (v !== undefined && v > 0.0001) hitInOpening++
  else { missInOpening++; if (missSample.length < 10) missSample.push({ k, openQty: v ?? 0, out: Number(r.out_qty) }) }
}
console.log(`\n③ 出库行批号情况:有批号 ${outWithLot} 行 / 无批号 ${outNoLot} 行(${(outNoLot / (outWithLot + outNoLot) * 100).toFixed(1)}% 无批号)`)
console.log(`④ 出库行能在"期初同键且为正"里命中的:${hitInOpening} 行 / 命中不了:${missInOpening} 行(${(missInOpening / outRows.length * 100).toFixed(1)}%)`)
console.log('\n   命中不了的样例(说明"上线当天做期初"并不能让这些出库自动对得上):')
for (const m of missSample) console.log(`     ${m.k.padEnd(44)} 期初=${String(m.openQty).padStart(10)}  出库=${m.out}`)

// 累计闭环:D0 期初 + 全部流水 vs 当前
const curRows = await fetchPoint('2026-10-19')
const cur = new Map()
for (const r of curRows) { const n = norm(r); const k = key(n.wzdm, n.ckdm, n.lot); cur.set(k, (cur.get(k) || 0) + n.qty) }
const net = new Map()
for (const r of after) { const k = key(r.material_number, r.stock_number, r.batch_no); net.set(k, (net.get(k) || 0) + Number(r.in_qty || 0) - Number(r.out_qty || 0)) }
const all = new Set([...open.keys(), ...net.keys(), ...cur.keys()])
let ok = 0; let bad = 0
for (const k of all) {
  const calc = (open.get(k) || 0) + (net.get(k) || 0)
  if (Math.abs(calc - (cur.get(k) || 0)) < 0.0001) ok++; else bad++
}
console.log(`\n⑤ 闭环:期初 + 流水 = 当前现存量  ·  一致 ${ok} / 不一致 ${bad}(键 ${all.size})`)
