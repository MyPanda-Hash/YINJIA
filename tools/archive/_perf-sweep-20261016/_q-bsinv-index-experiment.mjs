/**
 * _q-bsinv-index-experiment.mjs —— 「bs_inv.存货编码 加索引」的实测验证(在**测试账套**上做,可回滚)
 *
 * 背景(已量):待排产池那条 SQL 969 ms,去掉 bs_inv 的「重点管控」派生 JOIN 后 6 ms;
 * RECOMPILE / EXISTS / OUTER APPLY 都救不了 ⇒ 不是坏计划,是 **bs_inv.存货编码 没有索引**,
 * 优化器只能对每个工单行做一次 bs_inv 全表扫(nvarchar(400)+nvarchar(1000) 宽行 × 3917 行)。
 * 同一段派生 JOIN 还出现在 ScheduleBoardService(3 处)/ WorkOrderListController / OrderConvertService,
 * 所以这一条索引能一起提速:排产工作台、工单排产看板、生产工单列表、订单结转、流程管控。
 *
 * 用法: node tools/archive/_perf-sweep-20261016/_q-bsinv-index-experiment.mjs [db] [--drop]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES_TEST'
const DROP = process.argv.includes('--drop')
const IDX = 'IX_bs_inv_存货编码'

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = (s) => pool.request().query(s)

/* 与生产代码逐字同形的「待排产池」SQL(留全列 + 两个 LEFT JOIN + 排序) */
const POOL = `SELECT p.pl_no AS 加工单号, p.id AS 行id, p.pl_xc AS 工单行号, ISNULL(p.[批次号],N'') AS 批次号,
    CONVERT(varchar(10), p.pl_date, 120) AS 单据日期, ISNULL(p.od_no, N'') AS 客户订单号,
    ISNULL(dk.mc, p.khdm) AS 客户, ISNULL(管控.重点管控, N'否') AS 重点管控,
    p.dm AS 产品编号, ISNULL(p.mc, N'') AS 品名, ISNULL(p.gg, N'') AS 型号, ISNULL(p.jldw, N'') AS 单位,
    ISNULL(p.xq_sl, 0) AS 需求数量, ISNULL(p.pl_sl, 0) AS 排产数量,
    CONVERT(varchar(10), p.cp_date, 120) AS 工序交期,
    CASE WHEN p.cp_date IS NULL THEN NULL ELSE DATEDIFF(day, CAST(GETDATE() AS date), CAST(p.cp_date AS date)) END AS 交期紧迫度
  FROM dbo.plang p
  LEFT JOIN dbo.dm_kh dk ON dk.dm = p.khdm
  LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS 重点管控
               FROM bs_inv iv GROUP BY iv.存货编码) 管控 ON 管控.存货编码 = p.dm
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.ja,'N') NOT IN ('T','Y') AND ISNULL(p.scx, N'') = N''
 ORDER BY p.asp_time1 DESC, p.pl_date DESC, p.pl_no, p.pl_xc`

/** 订单结转「待结转行」的同族派生 JOIN(另一处受益点) */
const CONVERT = `SELECT COUNT(*) AS n FROM (
    SELECT l.[存货编码] FROM bd_so_order o
      JOIN bl_so_order l ON l.[单据编号] = o.[单据编号]
      LEFT JOIN (SELECT iv.存货编码, MAX(CASE WHEN iv.商品标签 LIKE N'%重点%' THEN N'是' ELSE N'否' END) AS m
                   FROM bs_inv iv GROUP BY iv.存货编码) 备注_管控 ON 备注_管控.存货编码 = l.[存货编码]
     WHERE ISNULL(o.asp_cancel,'N') <> 'Y') z`

async function bench(name, sql, times = 3) {
  const t = []
  let rows = 0
  for (let i = 0; i < times; i++) {
    const t0 = performance.now()
    const r = await q(sql)
    t.push(performance.now() - t0)
    rows = r.recordset.length
  }
  t.sort((a, b) => a - b)
  console.log(`  ${name.padEnd(28)} 中位 ${t[Math.floor(times / 2)].toFixed(0).padStart(6)} ms   (${rows} 行)`)
  return t[Math.floor(times / 2)]
}

const has = (await q(`SELECT COUNT(*) AS n FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.bs_inv') AND name = N'${IDX}'`)).recordset[0].n

if (DROP) {
  if (has) { await q(`DROP INDEX ${IDX} ON dbo.bs_inv`); console.log(`已删除 ${IDX}(${DB})`) }
  else console.log(`${IDX} 本就不存在(${DB})`)
  await pool.close()
  process.exit(0)
}

console.log(`== bs_inv 索引实验 @ ${DB} ==`)
console.log(`plang ${(await q('SELECT COUNT(*) AS n FROM plang')).recordset[0].n} 行 · bs_inv ${(await q('SELECT COUNT(*) AS n FROM bs_inv')).recordset[0].n} 行 · 索引${has ? '已存在' : '不存在'}`)
const before = has ? null : await bench('加索引前 · 待排产池', POOL)
if (!has) {
  await q(`CREATE INDEX ${IDX} ON dbo.bs_inv(存货编码) INCLUDE (商品标签)`)
  console.log(`  已建 ${IDX}(存货编码) INCLUDE (商品标签)`)
}
const after = await bench('加索引后 · 待排产池', POOL)
await bench('加索引后 · 订单结转派生段', CONVERT)
if (before != null) console.log(`\n  ⇒ 待排产池 ${before.toFixed(0)} ms → ${after.toFixed(0)} ms(提速 ${(before / Math.max(1, after)).toFixed(1)}×)`)
console.log(`\n回滚: node .../_q-bsinv-index-experiment.mjs ${DB} --drop`)
await pool.close()
