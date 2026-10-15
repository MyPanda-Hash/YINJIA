import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const show = async (tbl, label) => {
  const cols = (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${tbl}')`)).map((r) => r.name)
  const pick = ['单据日期', '批次号', '转ERP时间', '创建时间'].filter((c) => cols.includes(c))
  if (!pick.length) { console.log(`   ${label}: 无相关列`); return }
  console.log(`=== ${label} (${pick.join(' / ')}) ===`)
  for (const r of await q(`SELECT TOP 4 单据编号, ${pick.map((c) => '[' + c + ']').join(', ')} FROM ${tbl} WHERE asp_user1='试运行' ORDER BY id`)) {
    console.log('   ' + JSON.stringify(r))
  }
  // 一致性统计
  const has = (c) => cols.includes(c)
  const conds = []
  if (has('批次号')) conds.push(`SUM(CASE WHEN ISNULL([批次号],N'')=N'' THEN 1 ELSE 0 END) AS 批号空`)
  if (has('转ERP时间')) conds.push(`SUM(CASE WHEN [转ERP时间] IS NOT NULL AND CONVERT(date,[转ERP时间])<>CONVERT(date,[单据日期]) THEN 1 ELSE 0 END) AS 转ERP时间不符`)
  if (has('创建时间')) conds.push(`SUM(CASE WHEN [创建时间] IS NOT NULL AND TRY_CONVERT(date,[创建时间])<>CONVERT(date,[单据日期]) THEN 1 ELSE 0 END) AS 创建时间不符`)
  if (conds.length) console.log('   统计: ' + JSON.stringify((await q(`SELECT COUNT(*) AS 单数, ${conds.join(', ')} FROM ${tbl} WHERE asp_user1='试运行'`))[0]))
}
for (const [t, l] of [['bd_purchase_in', '采购入库单'], ['bd_sale_out', '销售出库单'], ['bd_material_out', '生产领料单'], ['bd_finish_in', '产品入库单']]) await show(t, l)
await pool.close()
