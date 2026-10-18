/**
 * _q-seed-consts.mjs —— 造数常量(面板前缀 / 产线清单 / 账号姓名 / 目标工单)(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-seed-consts.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR ${e.message}` } }

console.log('== 面板前缀 ==')
console.log('  ' + JSON.stringify(await q(`SELECT panel_code, prefix, code_col FROM yj_panel WHERE panel_code IN ('FINISH_IN','WO_REPORT','MATERIAL_OUT','QC_ASM_INSP')`)))

console.log('\n== 各车间产线(找 scx 用的名字,以及日产能现状)==')
for (const r of await q(`SELECT 生产车间, 生产线, ISNULL(日产能,0) AS 日产能 FROM bs_prod_line WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 生产车间, 生产线`))
  console.log(`  ${String(r.生产车间).padEnd(6)} ${String(r.生产线).padEnd(16)} 日产能=${r.日产能}`)

console.log('\n== 账号(报工人姓名用)==')
console.log('  ' + JSON.stringify(await q('SELECT username, real_name FROM yj_user')))

console.log('\n== 目标工单:近 30 天 · 未排产 · 有产品 · 数量>0(前 15)==')
for (const r of await q(`SELECT TOP 15 id, pl_no, pl_xc, dm, mc, ISNULL(jldw,'') AS jldw, xq_sl, pl_sl,
    CONVERT(varchar(10), pl_date, 120) AS d, ISNULL([工艺路线],N'') AS route, ISNULL(khdm,N'') AS kh
  FROM plang WHERE pl_date >= DATEADD(day,-30,CONVERT(date,GETDATE())) AND ISNULL(scx,N'')=N''
    AND ISNULL(xq_sl,0) > 0 ORDER BY pl_date DESC, id`))
  console.log(`  id=${String(r.id).padStart(4)} ${r.pl_no}#${r.pl_xc} ${String(r.dm).padEnd(10)} ${String(r.mc).slice(0, 16).padEnd(18)} ${String(r.jldw).padEnd(4)} 需求=${String(r.xq_sl).padStart(6)} 路线=${r.route} 下单=${r.d} 客户=${r.kh}`)

console.log('\n== 现有报工单号样式(避免撞号)==')
console.log('  ' + JSON.stringify(await q(`SELECT TOP 5 [报工单号], sc_date FROM scjl ORDER BY id DESC`)))
console.log('  s_allno 里 BG 类别: ' + JSON.stringify(await q(`SELECT TOP 5 dh, lb, ny FROM s_allno WHERE lb = N'BG' ORDER BY ID DESC`)))
console.log('  s_allno 类别清单: ' + JSON.stringify(await q(`SELECT lb, COUNT(*) AS n FROM s_allno GROUP BY lb ORDER BY COUNT(*) DESC`)))
await pool.close()
