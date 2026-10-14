/**
 * 库存对账(2026-10-14):MES `kucun` 逐键 vs 金蝶现存量 —— 历史回填的**唯一验收标准**。
 *
 * 比对键 = 商品编码 + 仓库编码 + 批号(与 kucun 三键 wzdm/ckdm/lot_no 同形);
 * 输出:键数/MES 有金蝶无/金蝶有 MES 无/数量不一致(带差异样例),写入 md 产物。
 *
 * 用法: node tools/archive/_verify-stock-vs-kingdee-1014.mjs [--db HSDZ_MES|HSDZ_MES_TEST|both]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const WHICH = arg('db', 'both')
const DBS = WHICH === 'both' ? ['HSDZ_MES', 'HSDZ_MES_TEST'] : [WHICH]

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8')).kingdee
const { token } = await fetchAppToken(cfg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const inv = []
for (let page = 1; page <= 200; page++) {
  const r = await kingdeeTryGet(cfg, token, '/jdy/v2/inv/inv_inventory_ims', { page: String(page), page_size: '50' })
  if (!r.ok) break
  const rows = r.data.rows || []
  inv.push(...rows)
  if (rows.length < 50) break
  await sleep(120)
}
const key = (w, c, l) => `${w}|${c}|${l || ''}`
const kd = new Map()
for (const r of inv) kd.set(key(r.material_number, r.stock_number, r.batch_no), (kd.get(key(r.material_number, r.stock_number, r.batch_no)) || 0) + Number(r.qty || 0))
console.log(`金蝶现存量:${inv.length} 行 / ${kd.size} 键`)

const md = ['# 库存对账:MES kucun ↔ 金蝶现存量', '', `- 时间:${new Date().toISOString()}  金蝶现存量 ${inv.length} 行 / ${kd.size} 键`, '']
for (const DB of DBS) {
  const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
  const rows = (await pool.request().query('SELECT wzdm, ckdm, lot_no, yl FROM kucun')).recordset
  const mes = new Map(rows.map((r) => [key(r.wzdm, r.ckdm, r.lot_no), Number(r.yl || 0)]))
  let same = 0, diff = 0, onlyMes = 0, onlyKd = 0
  const diffs = []
  for (const [k, v] of kd) {
    if (!mes.has(k)) { onlyKd++; if (diffs.length < 15) diffs.push([k, v, '(MES 无)']); continue }
    const m = mes.get(k)
    if (Math.abs(m - v) > 0.0001) { diff++; if (diffs.length < 15) diffs.push([k, v, m]) } else same++
  }
  for (const k of mes.keys()) if (!kd.has(k)) onlyMes++
  const total = kd.size
  console.log(`\n${DB}: 一致 ${same}/${total}  数量不一致 ${diff}  仅金蝶有 ${onlyKd}  仅 MES 有 ${onlyMes}  差异率 ${((diff + onlyKd) / Math.max(1, total) * 100).toFixed(1)}%`)
  md.push(`## ${DB}`, '', `| 项 | 数 |`, `|---|---|`, `| 金蝶键 | ${total} |`, `| **逐键一致** | ${same} |`, `| 数量不一致 | ${diff} |`, `| 仅金蝶有(MES 缺) | ${onlyKd} |`, `| 仅 MES 有 | ${onlyMes} |`, '')
  if (diffs.length) {
    md.push('| 键(商品\\|仓库\\|批号) | 金蝶 | MES |', '|---|---|---|')
    for (const [k, a, b] of diffs) md.push(`| \`${k}\` | ${a} | ${b} |`)
    md.push('')
  }
  await pool.close()
}
mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
writeFileSync(new URL('./_dump-out/stock-recon-1014.md', import.meta.url), md.join('\n'), 'utf8')
console.log('\n[产物] tools/archive/_dump-out/stock-recon-1014.md')
