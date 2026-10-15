/**
 * 把「批次号 / 转ERP时间 / 创建时间」对齐到单据日期(2026-10-16,正式库)
 *
 * 用户口径:「查看单据的批次号,转erp时间,创建时间,都要和单据日期对应」。
 * 现状(实测):金蝶同步下来的单据,这三个字段都写成**拉取当天**:
 *   · 批次号 = 供应商代码-<拉取日 yyyyMMdd>(如 SX-20261014,而单据日期是 10-13)✗
 *   · 转ERP时间 = 拉取时刻 ✗
 *   · 创建时间 = 拉取时刻 ✗
 * 做法(只动金蝶同步的那批 asp_user1='试运行'):
 *   · 批次号:把结尾的 8 位日期换成 单据日期 的 yyyyMMdd(无日期尾的保持原样);
 *   · 转ERP时间 = 单据日期;
 *   · 创建时间 = 单据日期(按原列型:varchar/日期 两种都处理)。
 * 用法: node tools/archive/_align-batch-erp-created-1016.mjs [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
import { writeFileSync } from 'node:fs'

const DRY = process.argv.includes('--dry')
const TABLES = ['bd_pu_order', 'bd_so_order', 'bd_purchase_in', 'bd_sale_out', 'bd_material_out', 'bd_finish_in', 'bd_other_in', 'bd_other_out']
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const colsOf = async (t) => (await q(`SELECT c.name, ty.name AS typ FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('${t}')`))

const before = []
for (const t of TABLES) {
  const cols = await colsOf(t)
  const has = (n) => cols.some((c) => c.name === n)
  const colType = (n) => (cols.find((c) => c.name === n) || {}).typ
  if (!has('单据日期')) { console.log(`   ${t}: 无单据日期列,跳过`); continue }
  for (const r of await q(`SELECT TOP 2 单据编号, [单据日期], ${has('批次号') ? '[批次号],' : ''} ${has('转ERP时间') ? '[转ERP时间],' : ''} ${has('创建时间') ? '[创建时间]' : '1 AS x'} FROM ${t} WHERE asp_user1='试运行' ORDER BY id`)) before.push({ t, ...r })
  if (DRY) continue
  // ① 批次号:结尾 8 位数字若 ≠ 单据日期的 yyyyMMdd,则替换
  let n1 = 0
  if (has('批次号')) n1 = (await pool.request().query(
    `UPDATE ${t} SET 批次号 = LEFT(批次号, LEN(批次号)-8) + CONVERT(varchar(8), 单据日期, 112)
     WHERE asp_user1=N'试运行' AND 批次号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
       AND RIGHT(批次号, 8) <> CONVERT(varchar(8), 单据日期, 112)`)).rowsAffected[0]
  // ② 转ERP时间 = 单据日期
  let n2 = 0
  if (has('转ERP时间')) n2 = (await pool.request().query(
    `UPDATE ${t} SET 转ERP时间 = 单据日期 WHERE asp_user1=N'试运行' AND 转ERP时间 IS NOT NULL
       AND CONVERT(date, 转ERP时间) <> CONVERT(date, 单据日期)`)).rowsAffected[0]
  // ③ 创建时间 = 单据日期(varchar 列写 yyyy-MM-dd HH:mm:ss;日期列直接赋日期)
  let n3 = 0
  if (has('创建时间')) {
    const isDate = ['date', 'datetime', 'datetime2', 'smalldatetime'].includes(colType('创建时间'))
    n3 = (await pool.request().query(
      isDate
        ? `UPDATE ${t} SET 创建时间 = 单据日期 WHERE asp_user1=N'试运行' AND 创建时间 IS NOT NULL AND CONVERT(date, 创建时间) <> CONVERT(date, 单据日期)`
        : `UPDATE ${t} SET 创建时间 = CONVERT(varchar(19), 单据日期, 120) WHERE asp_user1=N'试运行' AND ISNULL(创建时间,N'') <> N''
             AND LEFT(创建时间, 10) <> CONVERT(varchar(10), 单据日期, 120)`)).rowsAffected[0]
  }
  console.log(`   ${t}: 批次号 ${n1} / 转ERP时间 ${n2} / 创建时间 ${n3} 行已对齐`)
}
await pool.close()
if (DRY) { console.log('(dry-run,未改)'); process.exit(0) }
writeFileSync(new URL('./_dump-out/align-batch-erp-created-before-1016.json', import.meta.url), JSON.stringify(before, null, 1), 'utf8')
console.log('[改前样例] tools/archive/_dump-out/align-batch-erp-created-before-1016.json')

// 复核
const pool2 = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
for (const t of TABLES) {
  const r = (await pool2.request().query(
    `SELECT COUNT(*) AS 单数,
      SUM(CASE WHEN 批次号 LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]' AND RIGHT(批次号,8) <> CONVERT(varchar(8),单据日期,112) THEN 1 ELSE 0 END) AS 批次号不符,
      SUM(CASE WHEN 转ERP时间 IS NOT NULL AND CONVERT(date,转ERP时间) <> CONVERT(date,单据日期) THEN 1 ELSE 0 END) AS 转ERP时间不符
     FROM ${t} WHERE asp_user1=N'试运行'`)).recordset[0]
  console.log(`   复核 ${t}: ${JSON.stringify(r)}`)
}
await pool2.close()
