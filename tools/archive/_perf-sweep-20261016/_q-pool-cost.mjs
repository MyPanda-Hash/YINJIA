/**
 * _q-pool-cost.mjs —— 「待排产池」SQL 分段耗时(只读,2026-10-16 性能专项)
 *
 * 目的:ScheduleBoardService.pending() 实测 976 ms。别猜是哪一段 —— 把它的 4 个组成部分
 * 分别计时(同一条 WHERE,逐步拆掉 SELECT 列 / LEFT JOIN / 派生聚合),定位真凶。
 * 用法: node tools/archive/_perf-sweep-20261016/_q-pool-cost.mjs [db]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})

const WHERE = ` WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') NOT IN ('T','Y') AND ISNULL(p.scx, N'') = N'' `
const SEL = `SELECT p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 工单行号, ISNULL(p.[批次号],N'') AS 批次号,
    CONVERT(varchar(10), p.pl_date, 120) AS 单据日期, ISNULL(p.od_no, N'') AS 客户订单号,
    ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(管控.重点管控, N'否') AS 重点管控,
    p.dm AS 产品编号, ISNULL(p.mc, N'') AS 品名, ISNULL(p.gg, N'') AS 型号, ISNULL(p.jldw, N'') AS 单位,
    ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.pl_sl, 0) AS 排产数量,
    CONVERT(varchar(10), p.cp_date, 120) AS 工序交期,
    CASE WHEN p.cp_date IS NULL THEN NULL ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(p.cp_date AS date)) END AS 交期紧迫度
  FROM dbo.plang p
  LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm
  LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控
               FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm `
const ORDER = ` ORDER BY p.asp_time1 DESC, p.pl_date DESC, p.pl_no, p.pl_xc`

const CASES = [
  ['① 原样(全列 + 两 JOIN + 排序)', SEL + WHERE + ORDER],
  ['② 去掉「重点管控」派生 JOIN', SEL.replace(/LEFT JOIN \(SELECT iv[\s\S]*?管控 ON 管控\.存货编码 = p\.dm /, '').replace("ISNULL(管控.重点管控, N'否') AS 重点管控,", 'N\'否\' AS 重点管控,'), ],
  ['③ 去掉 dm_kh JOIN', SEL.replace('LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm', '').replace('ISNULL(dk.mc, p.khdm)', 'p.khdm').replace("ISNULL(管控.重点管控, N'否')", "N'否'").replace(/LEFT JOIN \(SELECT iv[\s\S]*?管控 ON 管控\.存货编码 = p\.dm /, ''), ],
  ['④ 只数数(无 JOIN 无排序)', 'SELECT COUNT(*) AS n FROM dbo.plang p' + WHERE],
  ['⑤ 原样但去掉排序', SEL + WHERE],
]

console.log(`== 待排产池 SQL 分段耗时 @ ${DB} ==`)
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

console.log('\n== 相关表规模与索引 ==')
for (const tb of ['plang', 'dm_kh', 'bs_inv']) {
  const cnt = (await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.${tb}`)).recordset[0].n
  const idx = (await pool.request().query(
    `SELECT i.name, i.type_desc, i.is_unique,
       STUFF((SELECT ',' + col.name FROM sys.index_columns ic JOIN sys.columns col
                ON col.object_id = ic.object_id AND col.column_id = ic.column_id
               WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,'') AS cols
       FROM sys.indexes i WHERE i.object_id = OBJECT_ID('dbo.${tb}') AND i.type > 0`)).recordset
  console.log(`  ${tb}: ${cnt} 行;索引 ${idx.length} 个 → ${idx.map((x) => x.name + '(' + x.cols + ')').join(' , ') || '无'}`)
}
await pool.close()
