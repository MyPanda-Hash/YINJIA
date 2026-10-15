/**
 * 标记改名:金蝶拉取 → 试运行(2026-10-16,正式库 HSDZ_MES)
 *
 * 用户口径:「拉下来的数据,不能说是金蝶拉取,我们是在假装一个月的试运行。写作试运行等都可以」。
 * 做法:动态扫出所有含 '金蝶拉取' 值的列(asp_user1/转ERP操作人 等),整表逐列 UPDATE 成 '试运行';
 *   只动**值等于**该标记的单元格,不做模糊匹配(避免误伤备注等文本)。
 *
 * 用法: node tools/archive/_rename-sync-marker-1014.mjs [--to 试运行] [--from 金蝶拉取] [--dry]
 */
import mssql from '../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const FROM = arg('from', '金蝶拉取')
const TO = arg('to', '试运行')
const DRY = argv.includes('--dry')

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: 'HSDZ_MES', user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

// 候选列:名字像"落库人/操作人"的文本列
const cols = await q(`
  SELECT t.name AS tbl, c.name AS col FROM sys.tables t
  JOIN sys.columns c ON c.object_id = t.object_id
  JOIN sys.types ty ON ty.user_type_id = c.user_type_id
  WHERE ty.name IN ('nvarchar','varchar') AND c.max_length >= 8
    AND (c.name LIKE '%asp_user%' OR c.name LIKE N'%操作人%' OR c.name LIKE N'%拉取%')`)
console.log(`扫描候选列 ${cols.length} 个(表×列)`)

let hitTables = 0, totalRows = 0
const done = []
for (const { tbl, col } of cols) {
  const n = (await q(`SELECT COUNT(*) AS n FROM [${tbl}] WHERE [${col}] = N'${FROM}'`))[0].n
  if (!n) continue
  hitTables++; totalRows += n
  done.push({ tbl, col, n })
  if (!DRY) {
    const r = await pool.request().query(`UPDATE [${tbl}] SET [${col}] = N'${TO}' WHERE [${col}] = N'${FROM}'`)
    console.log(`   ${tbl}.${col}: ${n} 行 → ${TO}(实际 ${r.rowsAffected[0]})`)
  } else {
    console.log(`   ${tbl}.${col}: ${n} 行(待改)`)
  }
}
await pool.close()
console.log(`\n命中 ${hitTables} 个表×列,共 ${totalRows} 行${DRY ? '(dry-run)' : ' 已改名'}`)
