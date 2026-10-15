/**
 * 全库批号一致性盘点(2026-10-16,正式库)
 * 口径:批号形如 `前缀-yyyyMMdd`(结尾 8 位数字)时,其日期段应等于**该行的单据日期**;
 *   若该表无 单据日期 列,则通过 单据编号 关联对应单据头(bd_* / 同名头表)取日期。
 * 输出:每张表的「日期后缀批号行数 / 其中与日期不一致行数」。
 */
import mssql from '../../deploy/node_modules/mssql/index.js'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset
const PAT = `LIKE N'%-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'`

// 所有含批号列的表
const tabs = await q(`SELECT DISTINCT t.name AS tbl FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id
  WHERE c.name IN (N'批号', N'批次号') ORDER BY t.name`)
const colsOf = async (t) => (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('${t}')`)).map((r) => r.name)

let totalRows = 0, totalBad = 0
const bad = []
for (const { tbl } of tabs) {
  const cols = await colsOf(tbl)
  const bcols = ['批号', '批次号'].filter((c) => cols.includes(c))
  const dateCol = cols.includes('单据日期') ? '单据日期' : null
  const noCol = ['单据编号', '单号', '来源单号'].find((c) => cols.includes(c)) || null
  if (!bcols.length) continue
  // 关联头表取日期(无 单据日期 列时)
  let join = '', dExpr = dateCol ? `x.[${dateCol}]` : null
  if (!dExpr && noCol) {
    const head = tbl.startsWith('bl_') ? 'bd_' + tbl.slice(3) : null
    const headExists = head ? (await q(`SELECT COUNT(*) AS n FROM sys.tables WHERE name='${head}'`))[0].n : 0
    if (headExists && (await colsOf(head)).includes('单据日期')) { join = `JOIN ${head} h ON h.单据编号 = x.[${noCol}]`; dExpr = 'h.[单据日期]' }
  }
  if (!dExpr) { bad.push({ tbl, note: '无日期来源,跳过' }); continue }
  for (const c of bcols) {
    const row = (await q(`SELECT COUNT(*) AS 总, SUM(CASE WHEN x.[${c}] IS NOT NULL AND x.[${c}] ${PAT} THEN 1 ELSE 0 END) AS 带日期,
        SUM(CASE WHEN x.[${c}] ${PAT} AND ${dExpr} IS NOT NULL AND RIGHT(x.[${c}],8) <> CONVERT(varchar(8), ${dExpr}, 112) THEN 1 ELSE 0 END) AS 不符
      FROM ${tbl} x ${join}`))[0]
    totalRows += Number(row.带日期) || 0; totalBad += Number(row.不符) || 0
    console.log(`   ${tbl}.${c}: 总 ${row.总} / 日期后缀批号 ${row.带日期} / **与日期不一致 ${row.不符}**`)
  }
}
console.log(`\n合计:日期后缀批号 ${totalRows} 行,其中不一致 **${totalBad}** 行`)
for (const b of bad) console.log(`   (${b.tbl}: ${b.note})`)
// 抽样看还有哪些批号形态(非日期后缀)
console.log('\n非日期后缀批号形态(前 8,说明为何不用改):')
for (const r of await q(`SELECT TOP 8 批号, COUNT(*) AS n FROM inh WHERE 批号 NOT ${PAT} GROUP BY 批号 ORDER BY n DESC`)) console.log('   inh ' + JSON.stringify(r))
await pool.close()
