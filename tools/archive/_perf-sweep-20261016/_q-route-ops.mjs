/**
 * _q-route-ops.mjs —— 工单工艺路线 ↔ 可用工序名称(造报工数据必须与引擎口径一致)(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-route-ops.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR ${e.message}` } }
const cols = async (t) => { const r = await q(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.${t}') ORDER BY c.column_id`); return typeof r === 'string' ? r : r.map((x) => x.name) }

console.log('== bs_route 是不是"一行一道工序"的路线表 ==')
console.log('  列: ' + (await cols('bs_route')).slice(0, 12).join(', '))
console.log('  路线清单: ' + JSON.stringify(await q(`SELECT 工艺路线编码, 工艺路线名称, COUNT(*) AS 工序数, MIN(加工顺序) AS 首序, MAX(加工顺序) AS 末序,
    ISNULL(审核状态,'') AS 审核状态 FROM bs_route WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 工艺路线编码, 工艺路线名称, 审核状态 ORDER BY 工艺路线编码`)))

console.log('\n== 每条路线的工序名称序列 ==')
for (const r of await q(`SELECT 工艺路线编码, STUFF((SELECT N' → ' + b.工序名称 FROM bs_route b
      WHERE b.工艺路线编码 = a.工艺路线编码 AND ISNULL(b.asp_cancel,'N')<>'Y'
      ORDER BY ISNULL(b.加工顺序,999) FOR XML PATH('')),1,3,'') AS 工序链
    FROM bs_route a WHERE ISNULL(a.asp_cancel,'N')<>'Y' GROUP BY 工艺路线编码 ORDER BY 工艺路线编码`))
  console.log(`  ${r.工艺路线编码}: ${r.工序链}`)

console.log('\n== 工序名称全集(看看有没有 混料/成型/切炭/组装/装箱)==')
console.log('  ' + JSON.stringify(await q(`SELECT DISTINCT 工序名称 FROM bs_route WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工序名称`)))
console.log('  bs_op: ' + JSON.stringify(await q(`SELECT 工序编码, 工序名称 FROM bs_op WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 工序编码`)))

console.log('\n== plang 的工艺路线列 ==')
console.log('  列名含"路线": ' + JSON.stringify((await cols('plang')).filter((c) => /路线|工艺/.test(c))))
console.log('  取值分布: ' + JSON.stringify(await q(`SELECT ISNULL([工艺路线],N'(空)') AS v, COUNT(*) AS n FROM plang GROUP BY [工艺路线] ORDER BY COUNT(*) DESC`)))

console.log('\n== 近 30 天工单里,最该造数的那批(有产品、有数量、未排产)==')
for (const r of await q(`SELECT TOP 10 pl_no, id, pl_xc, dm, mc, ISNULL(jldw,'') AS jldw, xq_sl, pl_sl,
    ISNULL(scx,N'') AS scx, ISNULL([工艺路线],N'') AS route, CONVERT(varchar(10), pl_date, 120) AS pl_date
  FROM plang WHERE pl_date >= DATEADD(day,-30,CONVERT(date,GETDATE())) AND ISNULL(scx,N'')=N''
    AND ISNULL(dm,N'')<>N'' AND ISNULL(xq_sl,0) > 0 ORDER BY pl_date DESC, id`))
  console.log(`  ${r.pl_no}#${r.pl_xc} 产品=${r.dm} ${String(r.mc).slice(0, 14)} 单位=${r.jldw} 需求=${r.xq_sl} 排产=${r.pl_sl} 路线=${r.route || '(空)'} 下单=${r.pl_date}`)
await pool.close()
