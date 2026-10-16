/**
 * _q-prod-data-state.mjs —— 生产看板各卡片的数据源现状(只读,2026-10-16 验收数据专项)
 * 用途:卡片「一直是生产中/暂无数据」到底缺哪一列/哪张表的哪一段,一次看清。
 * 用法: node tools/archive/_perf-sweep-20261016/_q-prod-data-state.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR ${e.message}` } }
const colsOf = async (t) => (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.${t}') ORDER BY c.column_id`)).map((x) => x.name)

console.log(`== ${DB} ==\n--- plang(工单表;看板 工单状态分布/车间生产分布/区间新增完工 都读它)---`)
console.log('  行数 = ' + JSON.stringify(await q('SELECT COUNT(*) AS n FROM plang')))
console.log('  关键列是否存在: ' + ['pl_no', 'id', 'pl_xc', 'scx', 'pl_sl', 'xq_sl', 'rk_no', 'rk_sl', 'cp_date', 'cp_date2', 'pl_date', '完工状态', 'ja', 'asp_cancel', 'asp_time1', 'asp_time2', 'khdm', 'dm', 'mc']
  .map((c) => (colsOf('plang') && true ? c : c)).join(', '))
const pl = (await q(`SELECT
    COUNT(*) AS 总行,
    SUM(CASE WHEN ISNULL(scx,N'')<>N'' THEN 1 ELSE 0 END) AS 有产线,
    SUM(CASE WHEN ISNULL(rk_no,N'')<>N'' THEN 1 ELSE 0 END) AS 有入库单号_已完工,
    SUM(CASE WHEN cp_date IS NOT NULL THEN 1 ELSE 0 END) AS 有完工日期,
    SUM(CASE WHEN ISNULL([完工状态],N'')<>N'' THEN 1 ELSE 0 END) AS 有完工状态,
    MIN(CONVERT(varchar(10), pl_date, 120)) AS 最早下单, MAX(CONVERT(varchar(10), pl_date, 120)) AS 最晚下单,
    MIN(CONVERT(varchar(10), cp_date, 120)) AS 最早完工, MAX(CONVERT(varchar(10), cp_date, 120)) AS 最晚完工
  FROM plang`))[0]
console.log('  ' + JSON.stringify(pl))
console.log('  近 30 天(pl_date)分布: ' + JSON.stringify((await q(`SELECT COUNT(*) AS n FROM plang
  WHERE pl_date >= DATEADD(day,-30,CONVERT(date,GETDATE())) AND pl_date < DATEADD(day,1,CONVERT(date,GETDATE()))`))[0]))
console.log('  完工状态取值: ' + JSON.stringify(await q(`SELECT ISNULL([完工状态],N'(空)') AS v, COUNT(*) AS n FROM plang GROUP BY [完工状态] ORDER BY COUNT(*) DESC`)))
console.log('  产线取值 TOP8: ' + JSON.stringify(await q(`SELECT TOP 8 ISNULL(scx,N'(空)') AS v, COUNT(*) AS n FROM plang GROUP BY scx ORDER BY COUNT(*) DESC`)))

console.log('\n--- scjl(报工记录;五工序报工完成率 + 产能对比 读它)---')
const sc = (await q(`SELECT COUNT(*) AS 总行,
    SUM(CASE WHEN ISNULL(gxdm,N'')<>N'' THEN 1 ELSE 0 END) AS 有工序代码,
    SUM(CASE WHEN ISNULL([完工状态],N'')<>N'' THEN 1 ELSE 0 END) AS 有完工状态,
    SUM(CASE WHEN ISNULL(scxmc,N'')<>N'' THEN 1 ELSE 0 END) AS 有产线名,
    SUM(CASE WHEN ISNULL(sl,0)<>0 THEN 1 ELSE 0 END) AS 有数量,
    SUM(CASE WHEN ISNULL(delmark,0)=0 THEN 1 ELSE 0 END) AS 未删除,
    MIN(CONVERT(varchar(10), sc_date, 120)) AS 最早, MAX(CONVERT(varchar(10), sc_date, 120)) AS 最晚
  FROM scjl`))[0]
console.log('  ' + JSON.stringify(sc))
console.log('  近 30 天(sc_date): ' + JSON.stringify((await q(`SELECT COUNT(*) AS n FROM scjl
  WHERE sc_date >= DATEADD(day,-30,CONVERT(date,GETDATE())) AND sc_date < DATEADD(day,1,CONVERT(date,GETDATE()))`))[0]))
console.log('  工序代码取值: ' + JSON.stringify(await q(`SELECT TOP 10 ISNULL(gxdm,N'(空)') AS v, COUNT(*) AS n FROM scjl GROUP BY gxdm ORDER BY COUNT(*) DESC`)))
console.log('  产线名取值 TOP8: ' + JSON.stringify(await q(`SELECT TOP 8 ISNULL(scxmc,N'(空)') AS v, COUNT(*) AS n, CAST(SUM(ISNULL(sl,0)) AS decimal(18,1)) AS 数量合计 FROM scjl GROUP BY scxmc ORDER BY COUNT(*) DESC`)))
console.log('  按月分布: ' + JSON.stringify(await q(`SELECT CONVERT(varchar(7), sc_date, 120) AS ym, COUNT(*) AS n, CAST(SUM(ISNULL(sl,0)) AS decimal(18,1)) AS qty FROM scjl GROUP BY CONVERT(varchar(7), sc_date, 120) ORDER BY ym`)))

console.log('\n--- bs_prod_line(产线档案;产能对比的上限来源)---')
console.log('  行数 = ' + JSON.stringify(await q('SELECT COUNT(*) AS n FROM bs_prod_line')))
console.log('  ' + JSON.stringify(await q(`SELECT TOP 8 生产线, ISNULL(日产能,0) AS 日产能, ISNULL(生产车间,'') AS 车间, ISNULL(停用,0) AS 停用 FROM bs_prod_line ORDER BY 生产线`)))
console.log('\n--- 入库流水(inh;概览/库存卡片)最近 ---')
console.log('  ' + JSON.stringify(await q(`SELECT TOP 5 CONVERT(varchar(10), 单据日期, 120) AS d, COUNT(*) AS n FROM inh GROUP BY CONVERT(varchar(10), 单据日期, 120) ORDER BY d DESC`)))
await pool.close()
