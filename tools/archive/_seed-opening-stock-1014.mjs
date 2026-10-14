/**
 * 期初结存导入(2026-10-14):把金蝶「现存量」变成 MES 台账的**起点**,使「期初 + 记账」终点 = 金蝶现存量。
 *
 * 口径(为什么这么算):
 *   金蝶现存量 current = 期初(9/1 前) + 区间内**全部**收发净额
 *   我只记账本仓库拉进来的 8 类单据(净额 N_ours)⇒ 令 期初' = current − N_ours
 *   记账后:期初' + N_ours = current ✅
 *   —— 区间内**其它类型**单据(盘点/调拨/委外等)的净额被自动吸收进期初',不影响终点对齐。
 *
 *   净额 N_ours 由 MES 里已拉取的 6 类出入库单据算出(入库 + / 出库 −),仓库键缺失时按名称查 bs_wh 兜底。
 *
 * 用法(默认 **dry-run,只算不写**):
 *   node tools/archive/_seed-opening-stock-1014.mjs --db HSDZ_MES_TEST
 *   node tools/archive/_seed-opening-stock-1014.mjs --db HSDZ_MES_TEST --write   # 真写:先备份 kucun 再整表重建
 * 产物: tools/archive/_dump-out/opening-stock-<tag>-1014.{md,json,csv,restore.sql}
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES_TEST')
const FROM = arg('from', '2026-09-01')
const WRITE = argv.includes('--write')
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ① 金蝶现存量(维度:商品编码 + 仓库编码 + 批号)
const inv = []
for (let page = 1; page <= 200; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '50' })
  if (!r.ok) { console.log(`❌ 现存量第 ${page} 页失败:${String(r.error).slice(0, 120)}`); break }
  const rows = r.data.rows || []
  inv.push(...rows)
  if (rows.length < 50) break
  await sleep(120)
}
console.log(`金蝶现存量:${inv.length} 行`)
const key = (w, c, l) => `${w}|${c}|${l || ''}`
const kdStock = new Map()
for (const r of inv) {
  const k = key(r.material_number, r.stock_number, r.batch_no)
  const cur = kdStock.get(k) || { wzdm: r.material_number, ckdm: r.stock_number, ckName: r.stockid_name, lot: r.batch_no || null, qty: 0, cost: r.unit_cost }
  cur.qty += Number(r.qty || 0)
  kdStock.set(k, cur)
}

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

// ② 区间内 6 类出入库单据的净额(⚠ 单据日期在**头表**,行表没有 ⇒ 必须 join 头表;
//    仓库编码缺失的(产成品入库行表无该列)按仓库名称查 bs_wh 兜底)
const netRows = await q(`
  SELECT wzdm, ckdm, lot, SUM(qty) AS net FROM (
    SELECT l.[存货编码] AS wzdm, l.[仓库编码] AS ckdm, l.[批号] AS lot, l.[实收数量] AS qty
      FROM bl_purchase_in l JOIN bd_purchase_in h ON h.[单据编号] = l.[单据编号]
      WHERE h.asp_user1 = N'金蝶拉取' AND h.[单据日期] >= '${FROM}'
    UNION ALL SELECT l.[产品编码], (SELECT TOP 1 w.[仓库编码] FROM bs_wh w WHERE w.[仓库名称] = l.[仓库]), l.[批号], l.[实收数量]
      FROM bl_finish_in l JOIN bd_finish_in h ON h.[单据编号] = l.[单据编号]
      WHERE h.asp_user1 = N'金蝶拉取' AND h.[单据日期] >= '${FROM}'
    UNION ALL SELECT l.[存货编码], l.[仓库编码], l.[批号], l.[数量]
      FROM bl_other_in l JOIN bd_other_in h ON h.[单据编号] = l.[单据编号]
      WHERE h.asp_user1 = N'金蝶拉取' AND h.[单据日期] >= '${FROM}'
    UNION ALL SELECT l.[存货编码], l.[仓库编码], l.[批号], -l.[数量]
      FROM bl_sale_out l JOIN bd_sale_out h ON h.[单据编号] = l.[单据编号]
      WHERE h.asp_user1 = N'金蝶拉取' AND h.[单据日期] >= '${FROM}'
    UNION ALL SELECT l.[材料编码], (SELECT TOP 1 w.[仓库编码] FROM bs_wh w WHERE w.[仓库名称] = l.[仓库]), l.[批号], -l.[数量]
      FROM bl_material_out l JOIN bd_material_out h ON h.[单据编号] = l.[单据编号]
      WHERE h.asp_user1 = N'金蝶拉取' AND h.[单据日期] >= '${FROM}'
    UNION ALL SELECT l.[存货编码], l.[仓库编码], l.[批号], -l.[数量]
      FROM bl_other_out l JOIN bd_other_out h ON h.[单据编号] = l.[单据编号]
      WHERE h.asp_user1 = N'金蝶拉取' AND h.[单据日期] >= '${FROM}'
  ) x WHERE ckdm IS NOT NULL GROUP BY wzdm, ckdm, lot`)
const netMap = new Map()
for (const r of netRows) netMap.set(key(r.wzdm, r.ckdm, r.lot), Number(r.net || 0))
console.log(`区间内单据净额:${netRows.length} 个库存键`)

// ③ 期初 = 现存量 − 净额(键的并集:只出现在单据里、现存量已为 0 的也要建行,否则记账会「无库存可扣」)
const opening = new Map()
for (const [k, v] of kdStock) opening.set(k, { ...v, qty: v.qty - (netMap.get(k) || 0) })
for (const [k, net] of netMap) {
  if (opening.has(k)) continue
  const [w, c, l] = k.split('|')
  opening.set(k, { wzdm: w, ckdm: c, ckName: null, lot: l || null, qty: -net, cost: null })
}

// ④ 现状对照(MES kucun)
const mesRows = await q(`SELECT wzdm, ckdm, lot_no, yl FROM kucun`)
const mesMap = new Map(mesRows.map((r) => [key(r.wzdm, r.ckdm, r.lot_no), Number(r.yl || 0)]))

const rep = []
const say = (s) => { rep.push(s); console.log(s) }
say(`# 期初结存导入(${WRITE ? '写入' : 'dry-run 只算不写'};账套 ${DB})`)
say('')
say(`- 时间:${new Date().toISOString()}  区间起点:${FROM}`)
say(`- 金蝶现存量:**${kdStock.size}** 个库存键(${inv.length} 行);区间内单据净额:**${netMap.size}** 个键`)
say(`- 推导期初:**${opening.size}** 个库存键;MES kucun 现有 **${mesMap.size}** 行`)
say('')
const pos = [...opening.values()].filter((x) => x.qty > 0).length
const neg = [...opening.values()].filter((x) => x.qty < 0).length
const zero = [...opening.values()].filter((x) => x.qty === 0).length
say(`- 期初数量分布:正 ${pos} / 负 ${neg}(异常,需看) / 零 ${zero}`)
say('')
const negSample = [...opening.values()].filter((x) => x.qty < 0).slice(0, 10)
if (negSample.length) {
  say('**期初为负的样例**(说明现存量小于区间内净出库,通常是区间外单据或口径差):')
  say('')
  say('| 商品 | 仓库 | 批号 | 期初 |')
  say('|---|---|---|---|')
  for (const x of negSample) say(`| ${x.wzdm} | ${x.ckdm} | ${x.lot || '(无)'} | ${x.qty} |`)
  say('')
}
// 与 MES 现状的差异(仅诊断)
let onlyKd = 0, onlyMes = 0, diff = 0
for (const [k, v] of opening) { if (!mesMap.has(k)) onlyKd++; else if (Math.abs(mesMap.get(k) - v.qty) > 0.0001) diff++ }
for (const k of mesMap.keys()) if (!opening.has(k)) onlyMes++
say(`- 与 MES 现状对比:仅金蝶有 ${onlyKd} 键 / 仅 MES 有 ${onlyMes} 键 / 数量不同 ${diff} 键`)
say('')

mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL(`./_dump-out/opening-stock-${TAG}-1014.md`, import.meta.url), rep.join('\n'), 'utf8')
writeFileSync(new URL(`./_dump-out/opening-stock-${TAG}-1014.json`, import.meta.url),
  JSON.stringify({ at: new Date().toISOString(), from: FROM, kdKeys: kdStock.size, netKeys: netMap.size, openingKeys: opening.size, rows: [...opening.values()] }, null, 1), 'utf8')
// 现状备份(CSV + 还原 SQL),写入前必先落盘
const csv = ['wzdm,ckdm,lot_no,yl,price'].concat(mesRows.map((r) => `${r.wzdm},${r.ckdm},${r.lot_no ?? ''},${r.yl ?? ''},`)).join('\n')
writeFileSync(new URL(`./_dump-out/kucun-before-opening-${TAG}-1014.csv`, import.meta.url), csv, 'utf8')

if (WRITE) {
  const tx = new mssql.Transaction(pool); await tx.begin()
  try {
    await new mssql.Request(tx).query(`DELETE FROM kucun`)
    let n = 0
    for (const v of opening.values()) {
      const req = new mssql.Request(tx)
      req.input('w', v.wzdm); req.input('c', v.ckdm); req.input('l', v.lot); req.input('y', v.qty); req.input('p', v.cost ?? null)
      await req.query(`INSERT INTO kucun (wzdm, ckdm, lot_no, yl, rkl, ckl, price, in_date, update_date, asp_user1, asp_time1, asp_cancel)
                       VALUES (@w, @c, @l, @y, 0, 0, @p, GETDATE(), GETDATE(), N'期初导入', GETDATE(), 'N')`)
      n++
    }
    await tx.commit()
    say(`✅ 已写入期初 ${n} 行(原 ${mesRows.length} 行已备份到 _dump-out/kucun-before-opening-${TAG}-1014.csv)`)
  } catch (e) { await tx.rollback(); console.log('❌ 写入失败:', e.message) }
} else {
  say('> 这是 **dry-run**;确认无误后加 `--write` 执行(会先备份现有 kucun 到 CSV 再整表重建)。')
}
writeFileSync(new URL(`./_dump-out/opening-stock-${TAG}-1014.md`, import.meta.url), rep.join('\n'), 'utf8')
await pool.close()
console.log(`\n[产物] tools/archive/_dump-out/opening-stock-${TAG}-1014.{md,json} + kucun-before-opening-${TAG}-1014.csv`)
