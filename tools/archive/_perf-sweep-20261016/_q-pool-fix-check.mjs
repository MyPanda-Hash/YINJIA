/**
 * _q-pool-fix-check.mjs —— 「重点管控」派生 JOIN 为何 970ms:坏计划 vs 缺索引(只读,性能专项)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-pool-fix-check.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

const DERIVED = `LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控
                   FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm`
const WHERE = ` WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') NOT IN ('T','Y') AND ISNULL(p.scx, N'') = N'' `
const COLS = `SELECT p.pl_no AS 加工单号, p.dm AS 产品编号, ISNULL(管控.重点管控, N'否') AS 重点管控
  FROM dbo.plang p ${DERIVED} ${WHERE}`

const CASES = [
  ['① 原样', COLS],
  ['② + OPTION (RECOMPILE)', COLS + ' OPTION (RECOMPILE)'],
  ['③ 派生表单独跑(bs_inv 聚合)', `SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控 FROM bs_inv iv GROUP BY iv.存货编码`],
  ['④ 派生表 + RECOMPILE', `SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控 FROM bs_inv iv GROUP BY iv.存货编码 OPTION (RECOMPILE)`],
  ['⑤ 换 EXISTS 形式(等价判定)', `SELECT p.pl_no AS 加工单号, p.dm AS 产品编号,
      CASE WHEN EXISTS (SELECT 1 FROM bs_inv iv WHERE iv.存货编码 = p.dm AND iv.商品标签 LIKE N'%重点%') THEN N'是' ELSE N'否' END AS 重点管控
    FROM dbo.plang p ${WHERE}`],
  ['⑥ 换 OUTER APPLY(索引 seek 友好)', `SELECT p.pl_no AS 加工单号, p.dm AS 产品编号,
      CASE WHEN x.n > 0 THEN N'是' ELSE N'否' END AS 重点管控
    FROM dbo.plang p
    OUTER APPLY (SELECT TOP 1 1 AS n FROM bs_inv iv WHERE iv.存货编码 = p.dm AND iv.商品标签 LIKE N'%重点%') x ${WHERE}`],
]

console.log(`== 「重点管控」段耗时对照 @ ${DB} ==`)
for (const [name, sql] of CASES) {
  const t = []
  let n = 0
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now()
    const r = await pool.request().query(sql)
    t.push(performance.now() - t0)
    n = r.recordset.length
  }
  t.sort((a, b) => a - b)
  console.log(`  ${name.padEnd(34)} 中位 ${t[1].toFixed(0).padStart(6)} ms   返回 ${n} 行`)
}

console.log('\n== bs_inv 关键列定义 ==')
for (const c of (await pool.request().query(`SELECT c.name, t.name AS ty, c.max_length, c.is_nullable
    FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
   WHERE c.object_id = OBJECT_ID('dbo.bs_inv') AND c.name IN (N'存货编码', N'商品标签')`)).recordset)
  console.log(`  ${c.name}: ${c.ty}(${c.max_length}) null=${c.is_nullable}`)
const s = (await pool.request().query(`SELECT COUNT(*) AS 总数,
    SUM(CASE WHEN 商品标签 LIKE N'%重点%' THEN 1 ELSE 0 END) AS 带重点 FROM bs_inv`)).recordset[0]
console.log(`  bs_inv 行数 ${s.总数} / 商品标签含「重点」${s.带重点} 行`)
const d = (await pool.request().query(`SELECT COUNT(DISTINCT 存货编码) AS 编码数 FROM bs_inv`)).recordset[0]
console.log(`  bs_inv 不同存货编码 ${d.编码数} 个(有重复编码时派生表会把「重点」并到同一编码)`)

console.log('\n== 一致性核对:三种写法是否给出同一结果 ==')
const a = (await pool.request().query(`SELECT COUNT(*) AS n FROM (${COLS.replace('SELECT p.pl_no AS 加工单号, p.dm AS 产品编号, ISNULL(管控.重点管控, N\'否\') AS 重点管控', 'SELECT p.id, ISNULL(管控.重点管控, N\'否\') AS m')}) z WHERE z.m = N'是'`)).recordset[0].n
const b = (await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.plang p ${WHERE} AND EXISTS (SELECT 1 FROM bs_inv iv WHERE iv.存货编码 = p.dm AND iv.商品标签 LIKE N'%重点%')`)).recordset[0].n
console.log(`  原写法「重点=是」${a} 行 / EXISTS 写法 ${b} 行 → ${a === b ? '一致 ✅' : '不一致 ❌(不能直接换写法)'}`)
await pool.close()
