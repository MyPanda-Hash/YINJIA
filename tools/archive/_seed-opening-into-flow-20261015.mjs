/**
 * _seed-opening-into-flow-20261015.mjs — 把「期初结存」补进**流水**(inh src=0)
 *
 * 为什么需要(2026-10-15,见 tools/archive/_stock-report-timeout/README.md §6.6):
 *   2026-10-14 的 _seed-opening-stock-1014.mjs 把金蝶现存量**只写进了 kucun**(rkl=0/ckl=0、
 *   asp_user1='期初导入'),**没写进流水**。而三张库存报表与移动加权成本**都读流水** ⇒
 *   出库多于入库:894 个成本分区里 **465 个期末为负**,按现状重算得到的库存价值是 **−9,487 万**。
 *   本脚本把那次推导出来的期初**补成流水行**,让「期初 + 记账」这条链在流水侧也成立。
 *
 * 数据源:tools/archive/_dump-out/opening-stock-<prod|test>-1014.json
 *   = 金蝶现存量 −(9/1 起 MES 已记账单据净额),键 = 物料编码 + 仓库编码 + 批号
 *
 * 期初行口径(与 migrate-stock-flow-history-backfill.sql 里那批期初行同形):
 *   src=0 / rid=NULL(视图用 id 合成键)/ 单据编号='INIT-20261014' / 单据类型='期初结存'
 *   / 单据日期='1900-01-01'(哨兵值,取远古日期是为了让补录的历史单据排在它之后)
 *   / 经手人=asp_user1='migration' / asp_cancel='N'
 *   / 数量=qty;单价、金额**留空** —— 金蝶该接口的 unit_cost 全部为空(2004/2004),
 *     没有可信来源就不编数,成本的分子从第一次有价入库开始累积。
 *   / 物料名称/规格型号/计量单位 从 bs_inv 补,仓库名称从 bs_wh 补(与面板显示一致)
 *
 * 幂等:先删「与新集合同键」的旧期初行再插;新集合里没有的旧期初行**保留**(不凭空清余额)。
 * 数量=0 的键跳过(不影响余额,kucun 侧本来也是 0)。
 *
 * 用法(默认 dry-run:整段写在一个事务里、跑完自检后 ROLLBACK):
 *   node tools/archive/_seed-opening-into-flow-20261015.mjs --db HSDZ_MES
 *   node tools/archive/_seed-opening-into-flow-20261015.mjs --db HSDZ_MES --write
 *   node tools/archive/_seed-opening-into-flow-20261015.mjs --db HSDZ_MES_TEST --tag test --write
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import mssql from '../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const TAG = arg('tag', DB === 'HSDZ_MES' ? 'prod' : 'test')
const WRITE = argv.includes('--write')
const INIT_NO = arg('no', 'INIT-20261014')

const src = new URL(`./_dump-out/opening-stock-${TAG}-1014.json`, import.meta.url)
const dump = JSON.parse(readFileSync(src, 'utf8'))
const all = dump.rows || []
const rows = all.filter((r) => Number(r.qty) !== 0)
console.log(`[读入] ${src.pathname.split(/[\\/]/).pop()}:${all.length} 键(其中数量 0 的 ${all.length - rows.length} 键跳过)`)
console.log(`         正 ${rows.filter((r) => r.qty > 0).length} / 负 ${rows.filter((r) => r.qty < 0).length}(期初本身为负,那次推导就标了"异常需看")`)
console.log(`[模式] ${WRITE ? '写入' : 'dry-run(事务末尾 ROLLBACK)'}  账套 ${DB}  单号前缀 ${INIT_NO}`)

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const tx = new mssql.Transaction(pool)
await tx.begin()
const q = async (sql) => (await new mssql.Request(tx).query(sql)).recordset
const say = (s) => console.log(s)

try {
  // ── 0. 备份现有期初行(src=0)──
  const before = await q(`SELECT * FROM inh WHERE src = 0`)
  mkdirSync(new URL('./_dump-out/', import.meta.url), { recursive: true })
  const cols = before.length ? Object.keys(before[0]) : []
  const csvPath = new URL(`./_dump-out/init-rows-before-flow-${TAG}-1015.csv`, import.meta.url)
  writeFileSync(csvPath, [cols.join(',')].concat(
    before.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n'), 'utf8')
  say(`[备份] 现有期初行 ${before.length} 行 → _dump-out/init-rows-before-flow-${TAG}-1015.csv`)

  // ── 1. 期初集合:直接用 VALUES 派生表(不用临时表 —— 连接池/事务下 #tmp 不保证跨请求存活)──
  const esc = (s) => (s == null ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`)
  const VALUES = rows.map((r) => `(${esc(r.wzdm)},${esc(r.ckdm)},${esc(r.lot)},CAST(${Number(r.qty)} AS decimal(18,4)))`).join(',')
  const SRC = `(VALUES ${VALUES}) AS o(wzdm, ckdm, lot, qty)`
  say(`[装载] VALUES 派生表 ${rows.length} 行`)

  // ── 2. 删「与新集合同键」的旧期初行(其它旧期初保留)──
  const del = await q(`DELETE i FROM inh i
     WHERE i.src = 0 AND EXISTS (SELECT 1 FROM ${SRC}
       WHERE RTRIM(i.物料编码) = RTRIM(o.wzdm)
         AND ISNULL(RTRIM(i.仓库编码),N'') = ISNULL(RTRIM(o.ckdm),N'')
         AND ISNULL(RTRIM(i.批号),N'') = ISNULL(RTRIM(o.lot),N''));
     SELECT @@ROWCOUNT AS n`)
  say(`[清同键] 删掉同键旧期初 ${del[0].n} 行`)

  // ── 3. 写入期初流水 ──
  const ins = await q(`
    INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                     仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 经手人, asp_user1, asp_time1, asp_cancel)
    SELECT 0, NULL, N'${INIT_NO}', N'期初结存', '1900-01-01',
           o.wzdm, i.存货名称, i.规格型号, i.计量单位,
           o.ckdm, w.仓库名称, NULLIF(RTRIM(o.lot), N''), o.qty, NULL, NULL,
           N'migration', N'migration', SYSDATETIME(), N'N'
      FROM ${SRC}
      LEFT JOIN bs_inv i ON RTRIM(i.存货编码) = RTRIM(o.wzdm)
      OUTER APPLY (SELECT TOP 1 x.仓库名称 FROM bs_wh x WHERE RTRIM(x.仓库编码) = RTRIM(o.ckdm) ORDER BY x.id) w
     WHERE NOT EXISTS (SELECT 1 FROM inh x WHERE x.src = 0
                         AND RTRIM(x.物料编码) = RTRIM(o.wzdm)
                         AND ISNULL(RTRIM(x.仓库编码),N'') = ISNULL(RTRIM(o.ckdm),N'')
                         AND ISNULL(RTRIM(x.批号),N'') = ISNULL(RTRIM(o.lot),N''));
    SELECT @@ROWCOUNT AS n`)
  say(`[写入] 新增期初流水 ${ins[0].n} 行`)

  // ── 4. 自检 ──
  const chk = (await q(`
    SELECT (SELECT COUNT(*) FROM inh WHERE src = 0) AS 期初行数,
           (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM inh WHERE src = 0) AS 期初数量合计,
           (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y') AS inh合计,
           (SELECT CAST(SUM(数量) AS decimal(18,2)) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS outh合计,
           (SELECT CAST(SUM(yl) AS decimal(18,2)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun合计,
           (SELECT COUNT(*) FROM v_stock_movement) AS 流水行数`))[0]
  for (const [k, v] of Object.entries(chk)) say(`[自检] ${k} = ${v}`)
  say(`[自检] 流水净额 = ${(Number(chk.inh合计) - Number(chk.outh合计)).toFixed(2)} vs kucun 余量 = ${chk.kucun合计}`)
  say(`[自检] 期初行未匹配档案(物料名称为空) ${(await q(`SELECT COUNT(*) AS n FROM inh WHERE src=0 AND 物料名称 IS NULL`))[0].n} 行`)

  // ── 5. 成本重算预演(新路径;整段一条批次,保证 #cs/#cr 活在同一条会话里)──
  const cost = (await q(`
    IF OBJECT_ID('tempdb..#cs') IS NOT NULL DROP TABLE #cs;
    SELECT src, rid, 仓库键, 存货编码, 批号, 单据日期,
           ISNULL(收入数量,0) AS 收入数量, ISNULL(发出数量,0) AS 发出数量, ISNULL(收入金额,0) AS 收入金额,
           ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY 单据日期, src, rid) AS rn
      INTO #cs FROM dbo.v_stock_movement;
    CREATE UNIQUE CLUSTERED INDEX IX_cs ON #cs (仓库键, 存货编码, rn);
    IF OBJECT_ID('tempdb..#cr') IS NOT NULL DROP TABLE #cr;
    WITH rec AS (
      SELECT rn, 仓库键, 存货编码,
             CAST(收入数量 - 发出数量 AS decimal(38,10)) AS 结存数量,
             CAST(收入金额 - 发出数量 * (CASE WHEN 收入数量<>0 THEN 收入金额/收入数量 ELSE 0 END) AS decimal(38,10)) AS 结存金额,
             CAST(发出数量 * (CASE WHEN 收入数量<>0 THEN 收入金额/收入数量 ELSE 0 END) AS decimal(38,10)) AS 发出成本金额
        FROM #cs WHERE rn = 1
      UNION ALL
      SELECT s.rn, s.仓库键, s.存货编码,
             CAST(rec.结存数量 + s.收入数量 - s.发出数量 AS decimal(38,10)),
             CAST(rec.结存金额 + s.收入金额 - s.发出数量 * (CASE WHEN rec.结存数量<>0 THEN rec.结存金额/rec.结存数量 ELSE 0 END) AS decimal(38,10)),
             CAST(s.发出数量 * (CASE WHEN rec.结存数量<>0 THEN rec.结存金额/rec.结存数量 ELSE 0 END) AS decimal(38,10))
        FROM rec JOIN #cs s ON s.仓库键 = rec.仓库键 AND s.存货编码 = rec.存货编码 AND s.rn = rec.rn + 1
    )
    SELECT * INTO #cr FROM rec OPTION (MAXRECURSION 0);
    WITH last AS (SELECT *, ROW_NUMBER() OVER (PARTITION BY 仓库键, 存货编码 ORDER BY rn DESC) AS rk FROM #cr)
    SELECT (SELECT COUNT(DISTINCT 仓库键 + N'|' + 存货编码) FROM #cr) AS 分区数,
           (SELECT COUNT(*) FROM last WHERE rk = 1 AND 结存数量 < 0) AS 末行负数分区,
           (SELECT CAST(SUM(结存金额) AS decimal(18,2)) FROM last WHERE rk = 1) AS 库存价值,
           (SELECT CAST(SUM(发出成本金额) AS decimal(18,2)) FROM #cr) AS 发出成本合计`))[0]
  for (const [k, v] of Object.entries(cost)) say(`[成本预演] ${k} = ${v}`)
  say(`[成本预演] 对照:补期初前 末行负数分区 = 465 / 库存价值 = -94,873,791.73`)

  if (WRITE) {
    await tx.commit()
    say(`✅ 已提交(${DB})`)
    say('   下一步:重算成本物化表(重启后端由启动自检自动跑,或点三张报表的「重算成本」)')
  } else {
    await tx.rollback()
    say('↩ dry-run:已 ROLLBACK,数据未改(确认无误后加 --write)')
  }
} catch (e) {
  try { await tx.rollback() } catch {}
  console.error('❌ 失败,已回滚:', e.message)
  process.exitCode = 1
} finally {
  await pool.close()
}
