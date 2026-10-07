/**
 * _probe-pu-label-index.cjs — 核对「一次一行一张单」口径在库侧落地(默认查**两个账套**)
 * 用法:node tools/archive/_probe-pu-label-index.cjs
 */
'use strict'
const { createRequire } = require('node:module')
const mssql = createRequire('D:/jdy-sync/package.json')('mssql')

async function main() {
  for (const db of ['HSDZ_MES', 'HSDZ_MES_TEST']) {
    const pool = await new mssql.ConnectionPool({
      server: '127.0.0.1', port: 1433, database: db, user: 'yinjia', password: 'Yinjia@2026',
      options: { encrypt: false, trustServerCertificate: true },
    }).connect()
    console.log(`\n=== ${db} ===`)
    const ix = (await new mssql.Request(pool).query(
      `SELECT i.name AS n, i.is_unique AS u FROM sys.indexes i
       WHERE i.object_id = OBJECT_ID(N'dbo.bd_pu_label') AND i.name IS NOT NULL ORDER BY i.name`)).recordset
    console.log('索引:', ix.map((r) => `${r.n}${r.u ? '(唯一)' : ''}`).join(', '))
    console.log(`  唯一索引 uq_bd_pu_label_order_batch 还在吗: ${ix.some((r) => r.n === 'uq_bd_pu_label_order_batch') ? '✗ 在(不该)' : '✔ 已废掉'}`)
    const desc = (await new mssql.Request(pool).query(
      `SELECT CAST(ep.value AS nvarchar(400)) AS v FROM sys.extended_properties ep
       WHERE ep.major_id = OBJECT_ID(N'dbo.bd_pu_label') AND ep.minor_id = 0 AND ep.name = 'MS_Description'`)).recordset[0]?.v || ''
    console.log(`  表级注明含新口径: ${desc.includes('每行各出一张单') ? '✔' : '✗'}  「${desc.slice(0, 60)}…」`)
    const docs = (await new mssql.Request(pool).query(
      `SELECT h.[单据编号] AS no, h.[批次号] AS b, COUNT(l.id) AS n, SUM(ISNULL(l.[打印数量],0)) AS q
       FROM bd_pu_label h LEFT JOIN bl_pu_label l
         ON l.[单据编号]=h.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
       WHERE ISNULL(h.asp_cancel,'N')<>'Y'
       GROUP BY h.[单据编号], h.[批次号] ORDER BY COUNT(l.id) DESC, h.[单据编号] DESC`)).recordset
    console.log(`  存活打印单 ${docs.length} 张:`, docs.map((d) => `${d.no}(${d.b} ${d.n}行 ${d.q})`).join(' / ') || '—')
    await pool.close()
  }
}
main().catch((e) => { console.error('异常:' + (e && e.stack || e)); process.exit(1) })
