/**
 * _q-seed-verify.mjs —— 播种后核对(scjl/yj_doc_status/plang 落库形态)(只读)
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
console.log(`== ${DB} 播种核对 ==`)
console.log('scjl 标记行: ' + JSON.stringify((await q(`SELECT COUNT(*) AS 行, COUNT(DISTINCT [报工单号]) AS 单数,
  SUM(CASE WHEN ISNULL(wgzt,'')='Y' THEN 1 ELSE 0 END) AS 已审核, SUM(CASE WHEN ISNULL(wgzt,'')='' THEN 1 ELSE 0 END) AS 未审核
  FROM scjl WHERE asp_user1 = N'demo-flow-20261016'`))[0]))
console.log('按工序/日期: ' + JSON.stringify(await q(`SELECT gxdm, COUNT(*) AS 行, MIN(CONVERT(varchar(10),sc_date,120)) AS 最早, MAX(CONVERT(varchar(10),sc_date,120)) AS 最晚
  FROM scjl WHERE asp_user1 = N'demo-flow-20261016' GROUP BY gxdm`)))
console.log('yj_doc_status(WO_REPORT/BG): ' + JSON.stringify(await q(`SELECT COUNT(*) AS 行, SUM(CASE WHEN pending='Y' THEN 1 ELSE 0 END) AS 待审批, SUM(CASE WHEN shsj IS NOT NULL THEN 1 ELSE 0 END) AS 已审核
  FROM yj_doc_status WHERE panel_code = N'WO_REPORT'`)))
console.log('plang 标记行: ' + JSON.stringify((await q(`SELECT COUNT(*) AS 行, SUM(CASE WHEN ISNULL(rk_no,'')<>'' THEN 1 ELSE 0 END) AS 已完工,
  SUM(CASE WHEN ISNULL([完工状态],'')<>'' THEN 1 ELSE 0 END) AS 有完工状态, MIN(scx) AS 线1 FROM plang WHERE asp_user1 = N'demo-flow-20261016'`))[0]))
console.log('概览 kpis 口径: ' + JSON.stringify(await q(`SELECT COUNT(*) AS 待审批总数 FROM yj_doc_status WHERE pending='Y'`)))
console.log('近 5 天报工分布: ' + JSON.stringify(await q(`SELECT CONVERT(varchar(10), sc_date, 120) AS d, COUNT(*) AS n, COUNT(DISTINCT scxmc) AS 线数
  FROM scjl WHERE asp_user1 = N'demo-flow-20261016' GROUP BY CONVERT(varchar(10), sc_date, 120) ORDER BY d DESC`)))
await pool.close()
