/**
 * 期初日(2026-09-01)之前的业务流水来源核实
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const a = await q(`SELECT N'inh' AS t, ISNULL(asp_user1,N'(空)') AS u, 单据类型 AS dt, COUNT(*) AS n,
                     CAST(SUM(数量) AS decimal(18,2)) AS qty
                FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期<'2026-09-01'
               GROUP BY asp_user1, 单据类型`)
const b = await q(`SELECT N'outh' AS t, ISNULL(asp_user1,N'(空)') AS u, 单据类型 AS dt, COUNT(*) AS n,
                     CAST(SUM(数量) AS decimal(18,2)) AS qty
                FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期<'2026-09-01'
               GROUP BY asp_user1, 单据类型`)
console.log('期初日前业务流水(会与 8/31 期初双计):')
for (const r of [...a, ...b]) console.log(`  ${r.t}  user=${String(r.u).padEnd(20)} ${String(r.dt).padEnd(12)} ${String(r.n).padStart(4)} 行  合计 ${r.qty}`)

const c = await q(`SELECT TOP 5 单据编号, asp_user1, asp_time1 FROM inh
                    WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期<'2026-09-01'`)
console.log('\n样例单号:', c.map((r) => `${r.单据编号}(user=${r.asp_user1})`).join(', '))
await pool.close()
