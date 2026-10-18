/**
 * _q-seed-facts.mjs —— 造"真实可信生产链演示数据"所需的字典事实(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-seed-facts.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR ${e.message}` } }
const cols = async (t) => { const r = await q(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.${t}') ORDER BY c.column_id`); return typeof r === 'string' ? r : r.map((x) => x.name) }

console.log('== scjl 全部列 ==')
console.log('  ' + (await cols('scjl')).join(', '))

console.log('\n== 工序档案 bs_op(五道工序) ==')
console.log('  ' + JSON.stringify(await q('SELECT TOP 12 工序编码, 工序名称 FROM bs_op WHERE ISNULL(asp_cancel,\'N\')<>\'Y\' ORDER BY 工序编码')))

console.log('\n== 工艺路线 bs_route / 工序序 ==')
console.log('  ' + JSON.stringify(await q("SELECT TOP 5 * FROM bs_route WHERE ISNULL(asp_cancel,'N')<>'Y'")))
console.log('  路线行表: ' + (await cols('bs_route_detail')).join(', '))

console.log('\n== 报工单 wo_process_line / 报工单号规则 ==')
for (const t of ['wo_process_line', 'wo_transfer_log']) {
  const c = await cols(t)
  console.log(`  ${t}: ${typeof c === 'string' ? c : c.join(', ')}`)
}
console.log('  yj_panel WO_REPORT 配置: ' + JSON.stringify(await q("SELECT panel_code, prefix, code_col, line_table, group_col FROM yj_panel WHERE panel_code='WO_REPORT'")))
console.log('  号池 s_allno 里 BG/报工 相关: ' + JSON.stringify(await q("SELECT TOP 8 * FROM s_allno WHERE 前缀 LIKE N'%BG%' OR 前缀 LIKE N'%RK%' ORDER BY 前缀")))

console.log('\n== 产线档案日产能 ==')
console.log('  ' + JSON.stringify((await q('SELECT COUNT(*) AS 总行, SUM(CASE WHEN ISNULL(日产能,0)>0 THEN 1 ELSE 0 END) AS 有日产能, MAX(日产能) AS 最大日产能 FROM bs_prod_line'))[0]))
console.log('  按车间: ' + JSON.stringify(await q('SELECT 生产车间, COUNT(*) AS 线数, SUM(CASE WHEN ISNULL(日产能,0)>0 THEN 1 ELSE 0 END) AS 有产能 FROM bs_prod_line GROUP BY 生产车间 ORDER BY 生产车间')))
console.log('  样例: ' + JSON.stringify(await q("SELECT TOP 6 生产线, 生产车间, 日产能 FROM bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 生产车间, 生产线")))

console.log('\n== 近 30 天可用的工单样本(plang) ==')
console.log('  ' + JSON.stringify(await q(`SELECT TOP 6 pl_no, id, pl_xc, dm, mc, xq_sl, pl_sl, scx, pl_date, cp_date,
    ISNULL([完工状态],N'') AS ws, ISNULL(rk_no,N'') AS rk FROM plang
  WHERE pl_date >= DATEADD(day,-30,CONVERT(date,GETDATE())) ORDER BY pl_date DESC`)))
console.log('  需求数量分布: ' + JSON.stringify((await q(`SELECT MIN(xq_sl) AS 最小, MAX(xq_sl) AS 最大, AVG(xq_sl) AS 均值, COUNT(*) AS n FROM plang WHERE xq_sl IS NOT NULL AND xq_sl > 0`))[0]))
console.log('  plang 客户/产品取样: ' + JSON.stringify(await q("SELECT TOP 4 khdm, dm, mc, gg, jldw, od_no FROM plang WHERE ISNULL(dm,'')<>''")))
await pool.close()
