/**
 * 用「带批号」的期初重新预测负结存
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const op = JSON.parse(readFileSync(new URL('./_out/opening-A-0831-lot.json', import.meta.url), 'utf8'))
const key = (w, c, l) => `${w}|${c}|${l || ''}`
const om = new Map()
for (const r of op) { const k = key(r.wzdm, r.ckdm, r.lot); om.set(k, (om.get(k) || 0) + r.qty) }

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const flow = (await pool.request().query(`
  SELECT wzdm, ckdm, lot, SUM(net) AS net FROM (
    SELECT RTRIM(物料编码) AS wzdm, ISNULL(RTRIM(仓库编码),N'') AS ckdm, ISNULL(RTRIM(批号),N'') AS lot, 数量 AS net
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 >= '2026-09-01'
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''), -数量
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
  ) x GROUP BY wzdm, ckdm, lot`)).recordset
const fm = new Map(flow.map((r) => [key(r.wzdm, r.ckdm, r.lot), Number(r.net || 0)]))

const all = new Set([...om.keys(), ...fm.keys()])
let pos = 0
const neg = []
for (const k of all) {
  const v = (om.get(k) || 0) + (fm.get(k) || 0)
  if (v < -1e-4) neg.push({ k, op: om.get(k) || 0, fl: fm.get(k) || 0, v })
  else if (v > 1e-4) pos++
}
neg.sort((a, b) => a.v - b.v)
console.log(`带批号期初预测:键 ${all.size} · 正 ${pos} · 负 ${neg.length} · 负合计 ${neg.reduce((s, x) => s + x.v, 0).toFixed(2)}`)
console.log('\n最负 12 个:')
for (const x of neg.slice(0, 12))
  console.log('  ' + x.k.padEnd(44) + '期初=' + x.op.toFixed(0).padStart(9) + '净额=' + x.fl.toFixed(0).padStart(9) + '期末=' + x.v.toFixed(0).padStart(9))

// 按物料汇总
const byMat = new Map()
for (const x of neg) { const w = x.k.split('|')[0]; byMat.set(w, (byMat.get(w) || 0) + x.v) }
const negMat = [...byMat.entries()].filter(([, v]) => v < -1e-4)
console.log(`\n负结存涉及物料 ${byMat.size} 个;按物料汇总仍为负 ${negMat.length} 个,合计 ${negMat.reduce((s, x) => s + x[1], 0).toFixed(2)}`)

// 对照:不带批号的期初会有多糟
const opOld = JSON.parse(readFileSync(new URL('./_out/opening-A-0831.json', import.meta.url), 'utf8')).filter((r) => Math.abs(r.qty) > 1e-5)
const om2 = new Map()
for (const r of opOld) { const k = key(r.wzdm, r.ckdm, r.lot); om2.set(k, (om2.get(k) || 0) + r.qty) }
const all2 = new Set([...om2.keys(), ...fm.keys()])
let neg2 = 0
for (const k of all2) if ((om2.get(k) || 0) + (fm.get(k) || 0) < -1e-4) neg2++
console.log(`\n对照:不带批号的期初 → 负结存 ${neg2} 行;带批号 → ${neg.length} 行`)
await pool.close()
