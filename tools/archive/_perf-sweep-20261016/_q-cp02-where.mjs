/**
 * _q-cp02-where.mjs —— CP-02 是谁、负结存从哪来(只读)
 * 用法: node tools/archive/_perf-sweep-20261016/_q-cp02-where.mjs [db] [code]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const DB = process.argv[2] || 'HSDZ_MES'
const CODE = process.argv[3] || 'CP-02'
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const q = async (s) => { try { return (await pool.request().query(s)).recordset } catch (e) { return `ERR: ${e.message}` } }

console.log(`== 哪个「编码列」里出现过 ${CODE} ==`)
const cands = [
  ['bs_wh', '仓库编码'], ['dm_ck', null], ['bs_wh_loc', '仓位编码'],
  ['bs_prod_line', '生产线'], ['bs_prod_line', '生产线编码'], ['mp_workshop', null],
]
for (const [t, c] of cands) {
  const cols = await q(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.${t}')`)
  if (typeof cols === 'string') { console.log(`  ${t}: 表不存在`); continue }
  const names = cols.map((x) => x.name)
  const hit = c ? (names.includes(c) ? [c] : []) : names.filter((n) => /编码|名称|code|dm|mc/i.test(n)).slice(0, 6)
  for (const col of hit) {
    const r = await q(`SELECT COUNT(*) AS n FROM dbo.${t} WHERE CAST([${col}] AS nvarchar(100)) LIKE N'%${CODE}%'`)
    if (typeof r !== 'string' && r[0].n > 0) {
      const sample = await q(`SELECT TOP 3 * FROM dbo.${t} WHERE CAST([${col}] AS nvarchar(100)) LIKE N'%${CODE}%'`)
      console.log(`  ✅ ${t}.${col} 命中 ${r[0].n} 行 → ${JSON.stringify(sample[0]).slice(0, 220)}`)
    }
  }
}

console.log(`\n== kucun 里所有 ckdm 取值(看 CP-* 是不是一类) ==`)
for (const r of await q(`SELECT ckdm, COUNT(*) AS 行数, CAST(SUM(yl) AS decimal(18,1)) AS 合计结余,
    SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END) AS 负行 FROM kucun GROUP BY ckdm ORDER BY COUNT(*) DESC`))
  console.log(`  ${String(r.ckdm).padEnd(10)} ${String(r.行数).padStart(4)} 行 合计 ${String(r.合计结余).padStart(14)} 负行 ${r.负行}`)

console.log(`\n== inh / outh 列名 ==`)
for (const t of ['inh', 'outh']) {
  const cols = (await q(`SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.${t}') ORDER BY c.column_id`)).map((x) => x.name)
  console.log(`  ${t}(${cols.length} 列): ${cols.slice(0, 14).join(', ')} ...`)
}

console.log(`\n== ${CODE} 的收发存:入库 vs 出库(列名:物料编码/仓库编码/批号/数量/单据日期)==`)
for (const t of ['inh', 'outh']) {
  const r = await q(`SELECT COUNT(*) AS 行数, CAST(ISNULL(SUM(数量),0) AS decimal(18,1)) AS 合计数量,
      MIN(CONVERT(varchar(10), 单据日期, 120)) AS 最早, MAX(CONVERT(varchar(10), 单据日期, 120)) AS 最晚
    FROM dbo.${t} WHERE 仓库编码 = N'${CODE}'`)
  console.log(`  ${t}: ${typeof r === 'string' ? r : JSON.stringify(r[0])}`)
}
for (const t of ['inh', 'outh']) {
  const d = await q(`SELECT TOP 5 物料编码, 批号, 数量, 单据编号, 单据类型, CONVERT(varchar(10), 单据日期, 120) AS 日期, src
    FROM dbo.${t} WHERE 仓库编码 = N'${CODE}' ORDER BY id`)
  console.log(`  ${t} 样例: ${JSON.stringify(d).slice(0, 360)}`)
}
console.log(`\n== 其它仓库也这样吗(入库/出库对比)==`)
for (const r of await q(`SELECT COALESCE(i.仓库编码, o.仓库编码) AS 仓库,
    ISNULL(i.行数,0) AS 入库行, ISNULL(i.合计,0) AS 入库量, ISNULL(o.行数,0) AS 出库行, ISNULL(o.合计,0) AS 出库量
  FROM (SELECT 仓库编码, COUNT(*) AS 行数, SUM(数量) AS 合计 FROM dbo.inh GROUP BY 仓库编码) i
  FULL JOIN (SELECT 仓库编码, COUNT(*) AS 行数, SUM(数量) AS 合计 FROM dbo.outh GROUP BY 仓库编码) o
    ON o.仓库编码 = i.仓库编码 ORDER BY ISNULL(i.行数,0) + ISNULL(o.行数,0) DESC`))
  console.log(`  ${String(r.仓库).padEnd(10)} 入库 ${String(r.入库行).padStart(4)} 行/${String(r.入库量).padStart(14)}   出库 ${String(r.出库行).padStart(4)} 行/${String(r.出库量).padStart(14)}`)

console.log(`\n== CP-02 在 kucun 的行:看它们是不是只有"出"没有"入" ==`)
for (const r of await q(`SELECT TOP 8 wzdm, ckdm, lot_no, yl, rkl, ckl, in_date FROM kucun
  WHERE ckdm = N'${CODE}' ORDER BY yl`))
  console.log(`  ${String(r.wzdm).padEnd(14)} 批号=${String(r.lot_no || '(空)').padEnd(12)} 结余=${String(r.yl).padStart(10)} 累计入=${String(r.rkl).padStart(8)} 累计出=${String(r.ckl).padStart(10)} in_date=${r.in_date}`)
await pool.close()
