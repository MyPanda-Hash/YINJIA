/** 只读探针:负结存规模 + inh/outh 表结构 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const db = process.env.QDB || 'HSDZ_MES'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: db, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('库:', db)
console.log('\n=== 负结存 kucun ===')
for (const r of await q(`SELECT COUNT(*) AS neg_rows, CAST(SUM(yl) AS decimal(18,2)) AS neg_sum
                           FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(yl,0) < -0.0001`))
  console.log(`   行数 ${r.neg_rows} / 合计 ${r.neg_sum}`)

const cols = async (t) => (await q(`SELECT COLUMN_NAME AS c, DATA_TYPE AS t, CHARACTER_MAXIMUM_LENGTH AS len, IS_NULLABLE AS nul
                                      FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='${t}' ORDER BY ORDINAL_POSITION`))
console.log('\n=== inh 列 ===')
console.log((await cols('inh')).map((x) => `${x.c}:${x.t}${x.len > 0 ? '(' + x.len + ')' : ''}`).join('  '))
console.log('\n=== kucun 列 ===')
console.log((await cols('kucun')).map((x) => `${x.c}:${x.t}${x.len > 0 ? '(' + x.len + ')' : ''}`).join('  '))

console.log('\n=== inh 单据类型 × src 分布(全部) ===')
for (const r of await q(`SELECT 单据类型 AS t, src, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS qty,
                                CONVERT(varchar(10),MIN(单据日期),120) AS d1, CONVERT(varchar(10),MAX(单据日期),120) AS d2
                           FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
                          GROUP BY 单据类型, src ORDER BY n DESC`))
  console.log(`   ${String(r.t).padEnd(12)} src=${String(r.src).padEnd(4)} ${String(r.n).padStart(6)} 行  ${String(r.qty).padStart(12)}  ${r.d1}~${r.d2}`)

await pool.close()
