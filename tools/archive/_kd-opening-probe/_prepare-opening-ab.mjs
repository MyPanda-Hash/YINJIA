/**
 * 备齐两套期初数据,供导入前对比选择:
 *   方案A「8/31 结存」  = /jdy/v2/scm/inventory?point_date=2026-08-31   (已有产物 pointdate-20260831.json)
 *   方案B「9/1 期初」   = 金蝶当前现存量 − 金蝶 9/1 后真实收发净额        (= 9/1 那天的期初)
 *
 * 两者只有当「9/1 之后 MES 已记账单据 == 金蝶 9/1 后全部单据」时才等价;
 * 实测不等价(调拨单 SCTL / 采购退货 CGTH 等 MES 未拉),故必须让用户拍板。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'
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
      { page: String(page), page_size: String(PAGE), point_date: date })
    if (!r.ok) { console.log(`  ❌ ${date} p${page}: ${r.error.slice(0, 90)}`); break }
    const rs = r.data.rows || []
    rows.push(...rs)
    if (rs.length < PAGE) break
    await sleep(90)
  }
  return rows
}

console.log('① 金蝶当前现存量(point_date=今天)…')
const curRaw = await fetchPoint('2026-10-19')
console.log(`   ${curRaw.length} 行`)

console.log('② 金蝶 9/1 后真实收发明细(2026-09 ~ 2026-10 逐月)…')
const after = []
for (const ym of ['2026-09', '2026-10']) {
  const s = `${ym}-01`
  const e = `${ym}-${new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()}`
  let cnt = 0
  for (let page = 1; page <= 200; page++) {
    const r = await kingdeeTryGet(cfg, token, '/jdy/v2/scm/inv_detail',
      { page: String(page), page_size: String(PAGE), start_date: s, end_date: e })
    if (!r.ok) break
    const rs = r.data.rows || []
    after.push(...rs); cnt += rs.length
    if (rs.length < PAGE) break
    await sleep(45)
  }
  console.log(`   ${ym}: ${cnt} 行`)
}

// 仓库 id → 编码(⚠ point_date 接口的 stock_number 恒为空,只有 stock_id,
//   ⇒ 必须用「现存量接口 inv_inventory_ims」建 stock_id → 仓库编码 的映射,
//   否则方案B 的键会变成一串 id,与 MES 的 ckdm 对不上)
const stkNumber = new Map()
const stkName = new Map()
for (let page = 1; page <= 30; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '500' })
  if (!r.ok) break
  const rs = r.data.rows || []
  for (const x of rs) {
    if (x.stock_id) { stkNumber.set(String(x.stock_id), x.stock_number); stkName.set(String(x.stock_id), x.stockid_name) }
  }
  if (rs.length < 500) break
  await sleep(80)
}
console.log(`   仓库映射 ${stkNumber.size} 个:${[...new Set(stkNumber.values())].join(',')}`)

const norm = (r) => ({
  wzdm: r.material_number,
  ckdm: r.stock_number || stkNumber.get(String(r.stock_id)) || String(r.stock_id),
  ckName: r.stock_name || stkName.get(String(r.stock_id)) || '',
  lot: r.batch_no || null,
  qty: Number(r.qty || 0),
})

// 方案A:8/31 结存
const pointA = await fetchPoint('2026-08-31')
const A = new Map()
for (const r of pointA) {
  const n = norm(r)
  A.set(key(n.wzdm, n.ckdm, n.lot), (A.get(key(n.wzdm, n.ckdm, n.lot)) || 0) + n.qty)
}
console.log(`③ 方案A(point_date=2026-08-31):${A.size} 键,合计 ${[...A.values()].reduce((s, v) => s + v, 0).toFixed(2)}`)

// 方案B:当前 − 9/1后净额
const curMap = new Map()
for (const r of curRaw) {
  const n = norm(r)
  curMap.set(key(n.wzdm, n.ckdm, n.lot), (curMap.get(key(n.wzdm, n.ckdm, n.lot)) || 0) + n.qty)
}
const netMap = new Map()
for (const r of after) {
  if (!r.bill_no || !r.stock_number) continue          // 只取真实收发
  const k = key(r.material_number, r.stock_number, r.batch_no)
  netMap.set(k, (netMap.get(k) || 0) + Number(r.in_qty || 0) - Number(r.out_qty || 0))
}
const B = new Map()
for (const [k, v] of curMap) B.set(k, v - (netMap.get(k) || 0))
for (const [k, v] of netMap) if (!B.has(k)) B.set(k, -v)
console.log(`④ 方案B(当前 − 9/1后净额):${B.size} 键,合计 ${[...B.values()].reduce((s, v) => s + v, 0).toFixed(2)}`)

// 对比
let same = 0, diff = 0, onlyA = 0, onlyB = 0
const bigDiffs = []
for (const [k, a] of A) {
  const b = B.get(k)
  if (b === undefined) { onlyA++; continue }
  if (Math.abs(a - b) < 0.0001) same++
  else { diff++; bigDiffs.push({ k, A: a, B: b, d: a - b }) }
}
for (const k of B.keys()) if (!A.has(k)) onlyB++
bigDiffs.sort((x, y) => Math.abs(y.d) - Math.abs(x.d))
console.log(`\n=== 方案A vs 方案B ===`)
console.log(`一致 ${same} / 不同 ${diff} / 仅A有 ${onlyA} / 仅B有 ${onlyB}`)
console.log(`差额绝对值合计 ${bigDiffs.reduce((s, x) => s + Math.abs(x.d), 0).toFixed(2)}`)
console.log('差异最大的 10 个:')
for (const d of bigDiffs.slice(0, 10)) console.log(`   ${d.k.padEnd(40)} A=${d.A.toFixed(2).padStart(12)} B=${d.B.toFixed(2).padStart(12)} 差=${d.d.toFixed(2)}`)

// MES 已记账的 9/1 后流水(用于判断方案B 是否与 MES 自洽)
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const mesNet = await q(`
  SELECT wzdm, ckdm, lot, SUM(qty) AS net FROM (
    SELECT RTRIM(物料编码) AS wzdm, ISNULL(RTRIM(仓库编码),N'') AS ckdm, ISNULL(RTRIM(批号),N'') AS lot, 数量 AS qty
      FROM inh WHERE src BETWEEN 1 AND 8 AND ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''), -数量
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
  ) x GROUP BY wzdm, ckdm, lot`)
const mes = new Map(mesNet.map((r) => [key(r.wzdm, r.ckdm, r.lot), Number(r.net || 0)]))
const mesSum = [...mes.values()].reduce((s, v) => s + v, 0)
const kdNetSum = [...netMap.values()].reduce((s, v) => s + v, 0)
console.log(`\n=== 9/1 后净额对照 ===`)
console.log(`  金蝶 9/1 后真实收发净额 = ${kdNetSum.toFixed(2)}`)
console.log(`  MES  9/1 后已记账净额   = ${mesSum.toFixed(2)}`)
console.log(`  差 = ${(kdNetSum - mesSum).toFixed(2)}  ← 这就是 MES 少拉单据造成的缺口`)
console.log(`\n⇒ 若导入方案A,期末 = A + MES净额 ;  若导入方案B,期末 = B + MES净额`)
console.log(`   A 期末 = ${([...A.values()].reduce((s,v)=>s+v,0) + mesSum).toFixed(2)}`)
console.log(`   B 期末 = ${([...B.values()].reduce((s,v)=>s+v,0) + mesSum).toFixed(2)}`)
console.log(`   金蝶当前现存量 = ${[...curMap.values()].reduce((s,v)=>s+v,0).toFixed(2)}`)

await pool.close()
mkdirSync(new URL('./_out/', import.meta.url), { recursive: true })
const dump = (m, name) => [...m.entries()]
  .filter(([, q]) => Math.abs(q) > 0.00001)
  .map(([k, q]) => { const [w, c, l] = k.split('|'); return { wzdm: w, ckdm: c, lot: l || null, qty: Number(q.toFixed(4)) } })
writeFileSync(new URL('./_out/opening-A-0831.json', import.meta.url), JSON.stringify(dump(A)), 'utf8')
writeFileSync(new URL('./_out/opening-B-0901.json', import.meta.url), JSON.stringify(dump(B)), 'utf8')
console.log(`\n[产物] _out/opening-A-0831.json(${dump(A).length} 行) · _out/opening-B-0901.json(${dump(B).length} 行)`)
