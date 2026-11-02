/** 只读探针 ③:入库单主表(rid 指向哪张表)、审核人字段、kucun 是否与流水一致、账套/期间 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset
const line = (t) => console.log('\n=== ' + t + ' ===')

line('候选主表(名字像入库单的表)')
for (const r of await q(`SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.TABLES
                          WHERE TABLE_TYPE='BASE TABLE' AND (TABLE_NAME LIKE '%in_head%' OR TABLE_NAME LIKE '%pur%'
                             OR TABLE_NAME LIKE 'bd_%' OR TABLE_NAME LIKE 'bs_%')
                          ORDER BY TABLE_NAME`))
  console.log('   ' + r.t)

line('rid=303 在哪些表里')
const tables = (await q(`SELECT TABLE_NAME AS t FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`)).map((x) => x.t)
for (const t of tables) {
  const hasId = await q(`SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' AND COLUMN_NAME='id' AND DATA_TYPE IN ('int','bigint')`)
  if (!hasId.length) continue
  try {
    const hit = await q(`SELECT COUNT(*) AS n FROM [${t}] WHERE id=303`)
    if (hit[0].n) console.log(`   ${t}: ${hit[0].n} 行`)
  } catch { /* 权限/类型问题忽略 */ }
}

line('kucun 合计 vs 流水净额')
for (const r of await q(`SELECT CAST(SUM(yl) AS decimal(18,2)) AS kucun_sum FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y'`)) console.log(`   kucun 合计 ${r.kucun_sum}`)
for (const r of await q(`SELECT CAST((SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y')
                                 - (SELECT SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS decimal(18,2)) AS net`)) console.log(`   inh - outh 净额 ${r.net}`)
for (const r of await q(`SELECT COUNT(*) AS n FROM kucun k
                          WHERE ISNULL(k.asp_cancel,'N')<>'Y' AND NOT EXISTS (SELECT 1 FROM inh x WHERE RTRIM(x.物料编码)=RTRIM(k.wzdm)
                             AND ISNULL(RTRIM(x.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'') AND ISNULL(RTRIM(x.批号),'')=ISNULL(RTRIM(k.lot_no),''))
                            AND NOT EXISTS (SELECT 1 FROM outh y WHERE RTRIM(y.物料编码)=RTRIM(k.wzdm)
                             AND ISNULL(RTRIM(y.仓库编码),'')=ISNULL(RTRIM(k.ckdm),'') AND ISNULL(RTRIM(y.批号),'')=ISNULL(RTRIM(k.lot_no),''))`))
  console.log(`   kucun 中无任何流水的键 ${r.n} 行`)

line('最新单据日期 / 月结结转')
for (const r of await q(`SELECT MAX(单据日期) AS dmax FROM inh`)) console.log(`   inh 最新 ${r.dmax}`)
for (const r of await q(`SELECT MAX(单据日期) AS dmax FROM outh`)) console.log(`   outh 最新 ${r.dmax}`)

line('负结存涉及仓库/批号分布')
for (const r of await q(`SELECT ckdm, COUNT(*) AS n, CAST(SUM(yl) AS decimal(18,2)) AS s,
                                SUM(CASE WHEN lot_no IS NULL THEN 1 ELSE 0 END) AS no_lot
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0)<-0.0001 GROUP BY ckdm ORDER BY s`))
  console.log(`   ${String(r.ckdm).padEnd(10)} ${String(r.n).padStart(4)}行 ${String(r.s).padStart(12)}  无批号 ${r.no_lot}`)

await pool.close()
