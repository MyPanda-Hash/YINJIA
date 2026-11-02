/**
 * 核实:库里现有的出入库单据是谁写进来的(同步脚本?导库?)
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const q = async (s) => (await pool.request().query(s)).recordset

const tables = [
  ['采购入库', 'bd_purchase_in'], ['销售出库', 'bd_sale_out'],
  ['材料出库', 'bd_material_out'], ['产成品入库', 'bd_finish_in'],
  ['其他入库', 'bd_other_in'], ['其他出库', 'bd_other_out'],
]
console.log('单据头表按 asp_user1 分布(看单据由谁写入):')
for (const [name, tbl] of tables) {
  const r = await q(`SELECT ISNULL(asp_user1,'(空)') AS u1, COUNT(*) AS n
                       FROM ${tbl} WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY asp_user1 ORDER BY COUNT(*) DESC`)
  console.log(`  ${name}: ` + r.map((x) => `${x.u1}=${x.n}`).join(', '))
}

console.log('\n外部数据ID(金蝶同步会写这一列)填充情况:')
for (const [name, tbl] of tables) {
  const r = (await q(`SELECT COUNT(*) AS n, SUM(CASE WHEN 外部数据ID IS NOT NULL AND RTRIM(外部数据ID)<>'' THEN 1 ELSE 0 END) AS has
                        FROM ${tbl} WHERE ISNULL(asp_cancel,'N')<>'Y'`))[0]
  console.log(`  ${name}: ${r.n} 张,带外部数据ID ${r.has} 张`)
}
await pool.close()
