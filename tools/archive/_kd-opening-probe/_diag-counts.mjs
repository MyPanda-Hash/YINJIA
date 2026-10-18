/**
 * 核对 inh/outh 实际规模与 src 分布
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const a = await q(`SELECT src, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS q,
                          SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废
                     FROM inh GROUP BY src ORDER BY src`)
console.log('inh 按 src:')
for (const r of a) console.log(`   src=${r.src}  ${String(r.n).padStart(5)} 行 / ${String(r.q).padStart(14)}  作废 ${r.已作废}`)

const b = await q(`SELECT COUNT(*) AS n, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS 已作废 FROM outh`)
console.log(`outh: ${b[0].n} 行, 作废 ${b[0].已作废}`)

const c = await q(`SELECT COUNT(*) AS n FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src=1`)
console.log(`inh src=1 未作废: ${c[0].n}`)
await pool.close()
