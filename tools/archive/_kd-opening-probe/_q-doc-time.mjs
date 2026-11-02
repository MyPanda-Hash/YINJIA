/**
 * 核实:出入库单据的 asp_time1(写入时间)分布 —— 判断它们是"实时从金蝶拉的"还是"某次批量导的"
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
console.log('单据"写入时间"分布(asp_user1=试运行 的行,按日):')
for (const [name, tbl] of tables) {
  const r = await q(`SELECT CONVERT(varchar(10), asp_time1, 120) AS d, COUNT(*) AS n
                       FROM ${tbl} WHERE asp_user1 = N'试运行' AND ISNULL(asp_cancel,'N')<>'Y'
                      GROUP BY CONVERT(varchar(10), asp_time1, 120) ORDER BY d`)
  console.log(`  ${name}: ` + (r.length ? r.map((x) => `${x.d}=${x.n}`).join('  ') : '(无)'))
}

console.log('\n清单登记表里有没有出入库单据类型:')
const c = await pool.request().query(`SELECT OBJECT_ID('yj_sync_log') AS x`)
if (c.recordset[0].x) {
  const r = await q(`SELECT TOP 20 * FROM yj_sync_log ORDER BY 1 DESC`).catch(() => [])
  console.log('  yj_sync_log 存在,最近记录:', r.length)
} else console.log('  yj_sync_log 不存在(无同步日志表)')

// 计划任务
console.log('\n计划任务(Windows):')
await pool.close()
