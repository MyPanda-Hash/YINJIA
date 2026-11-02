/** bs_inv 的全部 NOT NULL 列与其常用取值 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

console.log('=== bs_inv NOT NULL 列 ===')
for (const r of await q(`SELECT c.name AS col, t.name AS typ, c.max_length AS len, c.is_identity AS ident,
                                OBJECT_DEFINITION(c.default_object_id) AS dflt
                           FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
                          WHERE c.object_id=OBJECT_ID('bs_inv') AND c.is_nullable=0 AND c.is_identity=0
                          ORDER BY c.column_id`))
  console.log(`   ${String(r.col).padEnd(28)} ${String(r.typ).padEnd(12)} len=${r.len} default=${r.dflt ?? '(无)'}`)

console.log('\n=== 一条真实行的取值(抄它)===')
for (const r of await q(`SELECT TOP 2 * FROM bs_inv WHERE 数据来源='金蝶同步' ORDER BY id DESC`))
  console.log('   ' + JSON.stringify(r).slice(0, 900))
await pool.close()
