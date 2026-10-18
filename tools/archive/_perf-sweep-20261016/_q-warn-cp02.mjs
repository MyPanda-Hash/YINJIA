/**
 * _q-warn-cp02.mjs —— 库存预警现状 + CP-02 为什么进预警(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-warn-cp02.mjs [db] [code]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const CODE = process.argv[3] || 'CP-02'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log(`== ${DB} 库存预警现状(kucun)==`)
const sum = (await q(`SELECT COUNT(*) AS 总行,
    SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废,
    SUM(CASE WHEN ISNULL([预警数量],0) > 0 THEN 1 ELSE 0 END) AS 设了阈值,
    SUM(CASE WHEN ISNULL(yl,0) < 0 THEN 1 ELSE 0 END) AS 负结存,
    SUM(CASE WHEN yl IS NOT NULL AND yl < ISNULL(NULLIF([预警数量],0),50) THEN 1 ELSE 0 END) AS 低于阈值_未设回退50,
    SUM(CASE WHEN yl IS NOT NULL AND ISNULL([预警数量],0) > 0 AND yl < [预警数量] THEN 1 ELSE 0 END) AS 低于阈值_行级阈值
  FROM kucun`))[0]
console.log('  ' + JSON.stringify(sum))

console.log(`\n== kucun 里与「${CODE}」相关的行 ==`)
const rows = await q(`SELECT id, wzdm, ckdm, lot_no, yl, [预警数量] AS thr, in_date, rkl, ckl, ISNULL(asp_cancel,'N') AS cancel
  FROM kucun WHERE wzdm LIKE N'%${CODE}%' ORDER BY id`)
if (!rows.length) console.log('  (kucun 里没有该编码的行)')
for (const r of rows) {
  const t = (r.thr > 0 ? r.thr : 50)
  console.log(`  id=${r.id} 存货=${r.wzdm} 仓库=${r.ckdm} 批号=${r.lot_no || '(空)'} 结余=${r.yl} 阈值=${r.thr}${r.thr > 0 ? '' : '(未设→回退50)'} → ${Number(r.yl) < Number(t) ? '**进预警**' : '不进'}  入库${r.rkl}/出库${r.ckl} cancel=${r.cancel}`)
}

console.log(`\n== 该编码在档案里的名字 ==`)
for (const r of await q(`SELECT TOP 5 存货编码, 存货名称, 规格型号 FROM bs_inv WHERE 存货编码 LIKE N'%${CODE}%'`)) console.log('  ' + JSON.stringify(r))

console.log(`\n== 低库存预警接口实际吐出来的前 15 条 ==`)
const lg = JSON.parse(await (await fetch('http://127.0.0.1:8090/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).text()).data.token
const n = JSON.parse(await (await fetch('http://127.0.0.1:8090/api/portal/notice/list?type=alarm', {
  headers: { Authorization: 'Bearer ' + lg },
})).text())
const list = n.data || []
console.log(`  共 ${list.length} 条`)
for (const it of list.slice(0, 15)) console.log(`   [${it.type}] ${it.title || it.summary || ''} | ${String(it.content || '').slice(0, 70)} | threshold=${it.threshold} qty=${it.quantity}`)
const cp = list.filter((it) => String(it.inventoryCode || '').includes(CODE) || String(it.content || '').includes(CODE))
console.log(`  其中含「${CODE}」的 ${cp.length} 条:`)
for (const it of cp.slice(0, 8)) console.log('   ' + JSON.stringify({ title: it.title, content: it.content, quantity: it.quantity, threshold: it.threshold, warehouse: it.warehouse }))
await pool.close()
