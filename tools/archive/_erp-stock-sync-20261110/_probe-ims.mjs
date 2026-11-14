/**
 * _probe-ims.mjs — 只读:确认金蝶现存量接口的字段/行数/翻页/批号与仓库键的形态
 * 由来:2026-11-10「库存数量以金蝶真实账套为准」—— 先把接口事实钉死,再写同步器。
 * 用法:node tools/archive/_erp-stock-sync-20261110/_probe-ims.mjs
 * 产物:tools/archive/_dump-out/erp-stock-ims-probe-20261110.md
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs'

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const P = '/jdy/v2/inv/inv_inventory_ims'
const out = []
const say = (s) => { out.push(s); console.log(s) }

say('# 金蝶现存量接口取证(/jdy/v2/inv/inv_inventory_ims)')
say(`\n- 账套 clientId=${cfg.clientId} outerInstanceId=${cfg.outerInstanceId}  时间=${new Date().toISOString()}`)

const first = await kingdeeTryGet(cfg, token, P, { page: '1', page_size: '3' })
if (!first.ok) { console.log('❌ 接口失败:', first.error); process.exit(1) }
say(`\n- 顶层键:${Object.keys(first.data || {}).join(', ')}`)
say(`- count = ${first.data.count ?? first.data.total}`)
say(`- 首行键(${Object.keys((first.data.rows || [])[0] || {}).length}):${Object.keys((first.data.rows || [])[0] || {}).join(', ')}`)
say('\n```json\n' + JSON.stringify((first.data.rows || [])[0], null, 1).slice(0, 2500) + '\n```')

// 翻页拉全量(page_size 500)
const PAGE = 500
const rows = []
let pages = 0
for (let p = 1; p <= 40; p++) {
  const r = await kingdeeTryGet(cfg, token, P, { page: String(p), page_size: String(PAGE) })
  if (!r.ok) { say(`\n❌ 第 ${p} 页失败:${r.error}`); break }
  const rs = r.data.rows || []
  rows.push(...rs); pages++
  if (rs.length < PAGE) break
  await sleep(120)
}
say(`\n- 翻页实测:${pages} 页 · 共 ${rows.length} 行(page_size=${PAGE})`)

const cnt = (f) => rows.filter(f).length
const qtySum = rows.reduce((s, r) => s + Number(r.qty || 0), 0)
say(`\n## 键形态统计\n`)
say(`- 有 material_number:${cnt((r) => !!r.material_number)} / ${rows.length}`)
say(`- stock_number 为空:${cnt((r) => !r.stock_number)}(stock_id 有值 ${cnt((r) => !!r.stock_id)})`)
say(`- batch_no 为空:${cnt((r) => !r.batch_no)};= PC0000:${cnt((r) => r.batch_no === 'PC0000')};其它:${cnt((r) => r.batch_no && r.batch_no !== 'PC0000')}`)
say(`- 重复三键(物料|仓库|批号)组数:${rows.length - new Set(rows.map((r) => `${r.material_number}|${r.stock_number || r.stock_id}|${r.batch_no || ''}`)).size}`)
say(`- 数量合计:${qtySum.toFixed(4)};数量为 0 的行:${cnt((r) => Number(r.qty || 0) === 0)};负数行:${cnt((r) => Number(r.qty || 0) < 0)}`)
say(`- 单位键样例:${[...new Set(rows.slice(0, 40).map((r) => r.unit_name || r.unit_number || '(空)'))].join(' / ')}`)
say(`- 仓库样例:${[...new Set(rows.map((r) => `${r.stock_number || '?'}/${r.stockid_name || r.stock_name || '?'}`))].slice(0, 12).join(' · ')}`)

// 与 MES 侧对照(只读)
const mssql = (await import('../../../deploy/node_modules/mssql/index.js')).default
const base = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8')).database
const pool = await mssql.connect({
  server: base.server, port: base.port, database: 'HSDZ_MES', user: base.user, password: base.password,
  options: { encrypt: false, trustServerCertificate: true }, pool: { max: 4, min: 0, idleTimeoutMillis: 5000 },
})
const ku = (await pool.request().query(`SELECT wzdm, ckdm, lot_no, yl FROM dbo.kucun WHERE ISNULL(asp_cancel,'N') <> 'Y'`)).recordset
const key = (w, c, l) => `${String(w || '').trim()}|${String(c || '').trim()}|${String(l || '').trim()}`
const kd = new Map()
for (const r of rows) kd.set(key(r.material_number, r.stock_number, r.batch_no), (kd.get(key(r.material_number, r.stock_number, r.batch_no)) || 0) + Number(r.qty || 0))
const ms = new Map()
for (const r of ku) ms.set(key(r.wzdm, r.ckdm, r.lot_no), (ms.get(key(r.wzdm, r.ckdm, r.lot_no)) || 0) + Number(r.yl || 0))
const both = [...kd.keys()].filter((k) => ms.has(k))
const same = both.filter((k) => Math.abs(kd.get(k) - ms.get(k)) < 1e-6).length
say(`\n## 与 MES kucun 对照(HSDZ_MES,只读)\n`)
say(`- 金蝶键 ${kd.size} · MES 键 ${ms.size} · 交集 ${both.length}`)
say(`- 交集里逐键一致 ${same} / 数量不同 ${both.length - same}`)
say(`- 仅金蝶有 ${[...kd.keys()].filter((k) => !ms.has(k)).length} · 仅 MES 有 ${[...ms.keys()].filter((k) => !kd.has(k)).length}`)
say(`- 金蝶合计 ${qtySum.toFixed(2)} · MES 合计 ${[...ms.values()].reduce((s, v) => s + v, 0).toFixed(2)}`)
await pool.close()

mkdirSync(new URL('../_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('../_dump-out/erp-stock-ims-probe-20261110.md', import.meta.url), out.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/erp-stock-ims-probe-20261110.md')
