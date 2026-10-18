/**
 * 导入前诊断:预测导入后的负结存规模,并定位来源(只读,不写库)
 *   预期 kucun = 期初(8/31) + 9/1后业务流水净额
 */
import { readFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const opening = JSON.parse(readFileSync(new URL('./_out/opening-A-0831.json', import.meta.url), 'utf8'))
  .filter((r) => Math.abs(r.qty) > 0.00001)
const key = (w, c, l) => `${w}|${c}|${l || ''}`

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const op = new Map()
for (const r of opening) op.set(key(r.wzdm, r.ckdm, r.lot), (op.get(key(r.wzdm, r.ckdm, r.lot)) || 0) + r.qty)

// 9/1 后业务流水净额
const flow = await q(`
  SELECT wzdm, ckdm, lot, SUM(net) AS net, COUNT(*) AS n FROM (
    SELECT RTRIM(物料编码) AS wzdm, ISNULL(RTRIM(仓库编码),N'') AS ckdm, ISNULL(RTRIM(批号),N'') AS lot, 数量 AS net
      FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 >= '2026-09-01'
    UNION ALL
    SELECT RTRIM(物料编码), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''), -数量
      FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= '2026-09-01'
  ) x GROUP BY wzdm, ckdm, lot`)
const fl = new Map(flow.map((r) => [key(r.wzdm, r.ckdm, r.lot), Number(r.net || 0)]))

const all = new Set([...op.keys(), ...fl.keys()])
const neg = []
let pos = 0, zero = 0
for (const k of all) {
  const v = (op.get(k) || 0) + (fl.get(k) || 0)
  if (v < -0.0001) neg.push({ k, op: op.get(k) || 0, fl: fl.get(k) || 0, v })
  else if (v > 0.0001) pos++
  else zero++
}
neg.sort((a, b) => a.v - b.v)
console.log(`预测 kucun: ${all.size} 键 · 正 ${pos} · 负 ${neg.length} · 零 ${zero}`)
console.log(`负结存合计 ${neg.reduce((s, x) => s + x.v, 0).toFixed(2)}`)

// 负结存分类
const cat = { 期初为0且只有出库: 0, 期初为负: 0, 期初正但出更多: 0, 期末新增键无期初: 0 }
for (const x of neg) {
  if (x.op === undefined) cat.期末新增键无期初++
  else if (x.op <= 0.0001 && Math.abs(x.op) < 0.0001) cat.期初为0且只有出库++
  else if (x.op < -0.0001) cat.期初为负++
  else cat.期初正但出更多++
}
console.log('\n负结存构成:')
for (const [k, v] of Object.entries(cat)) console.log(`   ${k.padEnd(18)} ${v}`)

console.log('\n最负的 15 个:')
console.log('  键'.padEnd(46) + '期初'.padStart(14) + '9/1后净额'.padStart(14) + '期末'.padStart(14))
for (const x of neg.slice(0, 15))
  console.log('  ' + x.k.padEnd(44) + String(x.op.toFixed(2)).padStart(14) + String(x.fl.toFixed(2)).padStart(14) + String(x.v.toFixed(2)).padStart(14))

// 按物料汇总看是否只是批次拆分造成
const byMat = new Map()
for (const x of neg) {
  const w = x.k.split('|')[0]
  byMat.set(w, (byMat.get(w) || 0) + x.v)
}
const negMat = [...byMat.entries()].filter(([, v]) => v < -0.0001)
console.log(`\n涉及物料 ${byMat.size} 个,其中按物料汇总仍为负的 ${negMat.length} 个:`)
negMat.sort((a, b) => a[1] - b[1])
for (const [w, v] of negMat.slice(0, 15)) console.log(`   ${w.padEnd(24)} ${v.toFixed(2)}`)
await pool.close()
