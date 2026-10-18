/**
 * 核实 TCGRK / TXSCK 前缀单据是不是测试单据(只读)
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

const a = await q(`SELECT 单据编号, 单据日期, 单据状态, asp_user1, asp_cancel FROM bd_purchase_in WHERE 单据编号 LIKE 'TCGRK-%' ORDER BY 单据日期`)
console.log(`bd_purchase_in  TCGRK-* : ${a.length} 张`)
a.slice(0, 5).forEach((r) => console.log(`   ${r.单据编号}  ${String(r.单据日期).slice(0, 10)}  ${r.单据状态}  user=${r.asp_user1}  cancel=${r.asp_cancel}`))

const b = await q(`SELECT 单据编号, 单据日期, 单据状态, asp_user1, asp_cancel FROM bd_sale_out WHERE 单据编号 LIKE 'TXSCK-%' ORDER BY 单据日期`)
console.log(`bd_sale_out    TXSCK-* : ${b.length} 张`)
b.slice(0, 5).forEach((r) => console.log(`   ${r.单据编号}  ${String(r.单据日期).slice(0, 10)}  ${r.单据状态}  user=${r.asp_user1}  cancel=${r.asp_cancel}`))

const c = await q(`SELECT COUNT(*) AS n FROM bd_purchase_in WHERE 单据编号 LIKE 'TC%'`)
const d = await q(`SELECT COUNT(*) AS n FROM bd_sale_out WHERE 单据编号 LIKE 'TX%'`)
console.log(`\n全部 TC* 采购入库 ${c[0].n} 张 · 全部 TX* 销售出库 ${d[0].n} 张`)

// 真实金蝶单号形态对照
const e = await q(`SELECT TOP 3 单据编号, asp_user1 FROM bd_purchase_in WHERE 单据编号 LIKE 'CGRK-%'`)
console.log('真实金蝶单号样例:', e.map((r) => `${r.单据编号}(user=${r.asp_user1})`).join(', '))
await pool.close()
