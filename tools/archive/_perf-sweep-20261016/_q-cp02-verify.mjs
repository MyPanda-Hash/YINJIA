/**
 * _q-cp02-verify.mjs —— 确认 CP-02 与「成品B仓」是同一个仓库(编码 vs NULL 落不到同一库存键)(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-cp02-verify.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => (await pool.request().query(s)).recordset

console.log(`== ${DB}:出库流水里 CP-02 的仓库名称 ==`)
for (const r of await q(`SELECT 仓库编码, 仓库名称, COUNT(*) AS 行数 FROM dbo.outh GROUP BY 仓库编码, 仓库名称 ORDER BY COUNT(*) DESC`))
  console.log(`  ${String(r.仓库编码 === null ? '(NULL)' : r.仓库编码).padEnd(9)} ${String(r.仓库名称).padEnd(14)} ${r.行数} 行`)

console.log(`\n== 入库流水 ==`)
for (const r of await q(`SELECT 仓库编码, 仓库名称, COUNT(*) AS 行数 FROM dbo.inh GROUP BY 仓库编码, 仓库名称 ORDER BY COUNT(*) DESC`))
  console.log(`  ${String(r.仓库编码 === null ? '(NULL)' : r.仓库编码).padEnd(9)} ${String(r.仓库名称).padEnd(14)} ${r.行数} 行`)

console.log(`\n== 「成品B仓」这一对:入库(编码 NULL) vs 出库(编码 CP-02) 的规模 ==`)
const inB = (await q(`SELECT COUNT(*) AS 行数, CAST(ISNULL(SUM(数量),0) AS decimal(18,1)) AS 数量 FROM dbo.inh WHERE 仓库名称 = N'成品B仓'`))[0]
const outB = (await q(`SELECT COUNT(*) AS 行数, CAST(ISNULL(SUM(数量),0) AS decimal(18,1)) AS 数量 FROM dbo.outh WHERE 仓库编码 = N'CP-02'`))[0]
console.log(`  入:${JSON.stringify(inB)}`)
console.log(`  出:${JSON.stringify(outB)}`)
console.log(`  ⇒ 差额(出−入)= ${(Number(outB.数量) - Number(inB.数量)).toFixed(1)} —— kucun 里 CP-02 的合计负结存是 -1169674.8`)

console.log(`\n== kucun 里两个键的对照(同一批存货) ==`)
for (const r of await q(`SELECT ISNULL(ckdm,'(NULL)') AS 仓库编码, COUNT(*) AS 行数,
    CAST(SUM(yl) AS decimal(18,1)) AS 合计结余 FROM kucun
  WHERE ckdm = N'CP-02' OR ckdm IS NULL GROUP BY ckdm ORDER BY COUNT(*) DESC`))
  console.log(`  ${String(r.仓库编码).padEnd(9)} ${String(r.行数).padStart(4)} 行  合计结余 ${r.合计结余}`)
console.log(`  例:同存货在两边的结余`)
for (const r of await q(`SELECT k1.wzdm, k1.lot_no, k1.yl AS 出侧_CP02, k2.yl AS 入侧_null
  FROM kucun k1 LEFT JOIN kucun k2 ON k2.wzdm = k1.wzdm AND ISNULL(k2.lot_no,'') = ISNULL(k1.lot_no,'') AND k2.ckdm IS NULL
  WHERE k1.ckdm = N'CP-02' ORDER BY k1.yl`))
  console.log(`   ${String(r.wzdm).padEnd(14)} 批号=${String(r.lot_no || '').padEnd(12)} CP02=${String(r.出侧_CP02).padStart(10)}  null侧=${r.入侧_null}`)
await pool.close()
