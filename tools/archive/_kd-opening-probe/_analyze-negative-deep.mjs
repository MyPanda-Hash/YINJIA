/**
 * 追查 B1/B2 类("出库多于入库")的出库到底来自哪些单据 —— 是 9/1 后的真实领料,还是历史单据
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== ① 全库出库流水的时间分布 ===')
const a = await q(`
  SELECT CASE WHEN 单据日期 >= '2026-09-01' THEN N'9/1 及以后' ELSE N'9/1 之前' END AS 期间,
         COUNT(*) AS 行数, CAST(SUM(数量) AS decimal(18,2)) AS 数量
    FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY CASE WHEN 单据日期 >= '2026-09-01' THEN N'9/1 及以后' ELSE N'9/1 之前' END`)
for (const r of a) console.log(`   ${r.期间}: ${r.n ?? r.行数} 行 / ${r.数量}`)

console.log('\n=== ② 负结存最多的 YJ-SX-043 的全部出入库(YCL-01) ===')
const b = await q(`
  SELECT N'入' AS 方向, 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120) AS 日期,
         ISNULL(批号,N'(无)') AS 批号, CAST(数量 AS decimal(18,2)) AS 数量
    FROM inh WHERE 物料编码=N'YJ-SX-043' AND 仓库编码=N'YCL-01' AND ISNULL(asp_cancel,'N')<>'Y'
  UNION ALL
  SELECT N'出', 单据类型, 单据编号, CONVERT(varchar(10),单据日期,120), ISNULL(批号,N'(无)'), -数量
    FROM outh WHERE 物料编码=N'YJ-SX-043' AND 仓库编码=N'YCL-01' AND ISNULL(asp_cancel,'N')<>'Y'
   ORDER BY 日期`)
for (const r of b) console.log(`   ${r.日期} ${r.方向} ${String(r.单据类型).padEnd(10)} ${String(r.单据编号).padEnd(22)} 批=${String(r.批号).padEnd(14)} ${String(r.数量).padStart(10)}`)

console.log('\n=== ③ 该物料该仓的全部批号结存 ===')
const c = await q(`SELECT ISNULL(RTRIM(lot_no),'(无)') AS l, CAST(yl AS decimal(18,2)) AS yl
                     FROM kucun WHERE wzdm=N'YJ-SX-043' AND ckdm=N'YCL-01' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY yl DESC`)
for (const r of c) console.log(`   ${String(r.l).padEnd(16)} ${String(r.yl).padStart(10)}`)
console.log(`   合计 ${c.reduce((s, r) => s + Number(r.yl), 0).toFixed(2)}`)

console.log('\n=== ④ 金蝶侧:YJ-SX-043 在 YCL-01 的现存量 ===')
await pool.close()
