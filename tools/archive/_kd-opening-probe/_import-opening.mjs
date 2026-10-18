/**
 * 期初导入器 v2 —— 把金蝶结存(方案A)写成 MES 期初,并把期初日之后的业务流水并入结存
 *
 * ── 与 v1 的关键差异 ──
 * v1 只写「期初 = kucun」,那只在"库里没有业务流水"时成立。
 * 正式库有 9/1 之后的真实流水(入 1,707 行 / 出 3,329 行),所以正确口径是:
 *
 *     kucun.yl  =  期初数量  +  Σ(期初日之后的业务流水净额)
 *
 * 否则启动自检「结存 == Σ流水」(InvCostService.reconcileStockOnStartup)必然报警。
 *
 * ── 期初日之前的业务流水怎么办 ──
 * 期初已包含它们的影响(金蝶结存是时点值),若再算一遍就是**双计**。
 * 实测正式库期初日之前有 172 行(入 86 / 出 86),全部是
 * `asp_user1='test-seed'` 的 TCGRK / TXSCK 前缀 **测试造数**。
 * ⇒ `--exclude-test-seed`(默认开)把它们从 inh/outh **软删除**(asp_cancel='Y'),
 *    备份 CSV 落盘,可还原。
 *
 * ── 用法 ──
 *   node _import-opening.mjs --db HSDZ_MES                  # dry-run
 *   node _import-opening.mjs --db HSDZ_MES --write          # 真写
 *   node _import-opening.mjs --db HSDZ_MES --keep-test-seed # 不清理测试流水(不推荐)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES_TEST')
const WRITE = argv.includes('--write')
const EXCLUDE_TEST_SEED = !argv.includes('--keep-test-seed')
const NO = arg('no', 'INIT-20260831')
const CUT = arg('cut', '2026-09-01')          // 期初日:此日及之后的业务流水要并入结存
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'

// ⚠ 必须用**带批号**的这份(include_batch_kf_period=true 取回)。
//   /jdy/v2/scm/inventory 默认不返回批号,若用不带批号的版本导入,
//   期初会全部落在"无批号行",而 MES 9/1 后出库扣的是 PC0000 ⇒ 批号永远对不上,负结存反而更多。
const OPENING_FILE = arg('opening', './_out/opening-A-0831-lot.json')
const opening = JSON.parse(readFileSync(new URL(OPENING_FILE, import.meta.url), 'utf8'))
  .filter((r) => Math.abs(r.qty) > 0.00001)
const openSum = opening.reduce((s, r) => s + r.qty, 0)
console.log(`[读入] 期初 ${opening.length} 行 · 合计 ${openSum.toFixed(4)}`)
console.log(`[模式] ${WRITE ? '★写入' : 'dry-run(事务末尾 ROLLBACK)'}  账套 ${DB}  单号 ${NO}  期初日 ${CUT}`)
console.log(`[开关] 清理期初日前的 test-seed 测试流水 = ${EXCLUDE_TEST_SEED ? '是' : '否'}`)

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const tx = new mssql.Transaction(pool)
await tx.begin()
const q = async (sql) => (await new mssql.Request(tx).query(sql)).recordset
const log = (s) => console.log(s)
const csvOf = (rows) => {
  if (!rows.length) return ''
  const cols = Object.keys(rows[0])
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n')
}
const out = (name, content) => writeFileSync(new URL(`./_out/${name}`, import.meta.url), content, 'utf8')

try {
  // ── 0. 备份 ──
  const oldInit = await q(`SELECT * FROM inh WHERE src = 0 OR 单据类型 = N'月结结转'`)
  const oldKucun = await q(`SELECT * FROM kucun`)
  out(`backup-inh-init-before-${TAG}.csv`, csvOf(oldInit))
  out(`backup-kucun-before-${TAG}.csv`, csvOf(oldKucun))
  log(`[备份] inh 旧期初/结转 ${oldInit.length} 行 · kucun ${oldKucun.length} 行`)

  // ── 1. 期初日之前的业务流水(与期初双计)──
  const preDocs = await q(`
    SELECT 方向, ISNULL(asp_user1,N'') AS src_user1, COUNT(*) AS n, CAST(SUM(数量) AS decimal(18,2)) AS qty
      FROM (SELECT N'入' AS 方向, asp_user1, 数量 FROM inh
             WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期 < '${CUT}'
            UNION ALL
            SELECT N'出', asp_user1, 数量 FROM outh
             WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '${CUT}') t
     GROUP BY 方向, ISNULL(asp_user1,N'')`)
  const preTotal = preDocs.reduce((s, r) => s + Number(r.n), 0)
  log(`[期初日前流水] 共 ${preTotal} 行:` + (preDocs.length ? '' : '(无)'))
  for (const r of preDocs) log(`    ${r.方向} src_user1='${r.src_user1}' ${r.n} 行 合计 ${r.qty}`)

  let hiddenIn = 0, hiddenOut = 0
  if (EXCLUDE_TEST_SEED && preTotal > 0) {
    // 测试造数单据的识别口径(两者取并集,避免漏网):
    //   ① asp_user1='test-seed'(种子脚本原样写入的)
    //   ② 单据编号 TCGRK-* / TXSCK-*(T 前缀 = 测试;实测被 backfill 脚本补流水后
    //      asp_user1 被改成了 'migration-backfill',只按 user 判会漏掉 172 行)
    const TEST_WHERE = `(asp_user1 = N'test-seed'
                          OR 单据编号 LIKE N'TCGRK-%' OR 单据编号 LIKE N'TXSCK-%')`
    const delIn = await q(`SELECT * FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8
                            AND 单据日期 < '${CUT}' AND ${TEST_WHERE}`)
    const delOut = await q(`SELECT * FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
                             AND 单据日期 < '${CUT}' AND ${TEST_WHERE}`)
    out(`backup-testseed-hidden-inh-${TAG}.csv`, csvOf(delIn))
    out(`backup-testseed-hidden-outh-${TAG}.csv`, csvOf(delOut))
    if (delIn.length) {
      await q(`UPDATE inh SET asp_cancel='Y', asp_user2=N'opening-import', asp_time2=SYSDATETIME()
                WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8
                  AND 单据日期 < '${CUT}' AND ${TEST_WHERE}`)
    }
    if (delOut.length) {
      await q(`UPDATE outh SET asp_cancel='Y', asp_user2=N'opening-import', asp_time2=SYSDATETIME()
                WHERE ISNULL(asp_cancel,'N')<>'Y'
                  AND 单据日期 < '${CUT}' AND ${TEST_WHERE}`)
    }
    hiddenIn = delIn.length; hiddenOut = delOut.length
    log(`[清理] 软删除期初日前测试流水:inh ${hiddenIn} 行 / outh ${hiddenOut} 行(已备份 CSV)`)

    // 清完后仍有残余 ⇒ 不是测试单据,必须人工决策,直接拦下
    const leftIn = await q(`SELECT COUNT(*) AS n FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
                             AND src BETWEEN 1 AND 8 AND 单据日期 < '${CUT}'`)
    const leftOut = await q(`SELECT COUNT(*) AS n FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 < '${CUT}'`)
    const left = Number(leftIn[0].n) + Number(leftOut[0].n)
    if (left > 0) {
      throw new Error(`期初日前仍有 ${left} 行非测试业务流水(inh ${leftIn[0].n} / outh ${leftOut[0].n}),`
        + `会与 8/31 期初双计。请先确认这些单据,或调整 --cut 期初日后再导入`)
    }
    log('   ✅ 期初日前的业务流水已清零')
  }

  // ── 2. 清旧期初 ──
  const delInit = await q(`DELETE FROM inh WHERE src = 0 OR 单据类型 = N'月结结转'; SELECT @@ROWCOUNT AS n`)
  log(`[清理] 删 inh 旧期初/结转 ${delInit[0].n} 行`)

  // ── 3. 写 inh 期初 ──
  const esc = (s) => (s == null ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`)
  const CHUNK = 500
  let insInh = 0
  for (let i = 0; i < opening.length; i += CHUNK) {
    const VALUES = opening.slice(i, i + CHUNK)
      .map((r) => `(${esc(r.wzdm)},${esc(r.ckdm)},${esc(r.lot)},CAST(${Number(r.qty)} AS decimal(18,4)))`).join(',')
    const r = await q(`
      INSERT INTO inh (src, rid, 单据编号, 单据类型, 单据日期, 物料编码, 物料名称, 规格型号, 计量单位,
                       仓库编码, 仓库名称, 批号, 数量, 单价, 金额, 经手人, asp_user1, asp_time1, asp_cancel)
      SELECT 0, NULL, N'${NO}', N'期初结存', CAST('1900-01-01' AS datetime),
             o.wzdm, i.存货名称, i.规格型号, i.计量单位,
             o.ckdm, w.仓库名称, NULLIF(RTRIM(o.lot), N''), o.qty, NULL, NULL,
             N'migration', N'migration', SYSDATETIME(), N'N'
        FROM (VALUES ${VALUES}) AS o(wzdm, ckdm, lot, qty)
        OUTER APPLY (SELECT TOP 1 x.存货名称, x.规格型号, x.计量单位 FROM bs_inv x
                      WHERE RTRIM(x.存货编码) = RTRIM(o.wzdm) ORDER BY x.id) i
        OUTER APPLY (SELECT TOP 1 x.仓库名称 FROM bs_wh x
                      WHERE RTRIM(x.仓库编码) = RTRIM(o.ckdm) ORDER BY x.id) w;
      SELECT @@ROWCOUNT AS n`)
    insInh += r[0].n
  }
  log(`[写入] inh 期初 ${insInh} 行`)

  // ── 4. 按流水重算 kucun(期初 + 期初日之后的业务流水)──
  //   与 StockMonthCloseService.reconcileKucun 同口径:yl = 期初 + Σ(入 − 出),
  //   但**不含月结结转**(它是期间标记,不是新入库 —— 见 v_stock_movement 的过滤)
  const delKucun = await q(`DELETE FROM kucun; SELECT @@ROWCOUNT AS n`)
  const kc = await q(`
    INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, price, asp_user1, asp_time1, asp_cancel)
    SELECT a.w, a.c, a.l, GETDATE(),
           CAST(0 AS float), CAST(0 AS float), CAST(a.net AS float), NULL,
           N'期初导入', GETDATE(), 'N'
      FROM (
        SELECT CONCAT(物料编码, N'|', ISNULL(RTRIM(仓库编码),N''), N'|', ISNULL(批号,N'')) AS k,
               MIN(物料编码) AS w, MIN(仓库编码) AS c, MIN(批号) AS l,
               SUM(数量) AS net
          FROM (SELECT 物料编码, 仓库编码, 批号, 数量 FROM inh
                 WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,N'') <> N'月结结转'
                UNION ALL
                SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
                 WHERE ISNULL(asp_cancel,'N') <> 'Y') s
         GROUP BY CONCAT(物料编码, N'|', ISNULL(RTRIM(仓库编码),N''), N'|', ISNULL(批号,N''))
      ) a
     WHERE ABS(a.net) > 0.0001;
    SELECT @@ROWCOUNT AS n`)
  log(`[清理] 清 kucun ${delKucun[0].n} 行 → [重建] ${kc[0].n} 行(期初 + 期初日后业务流水)`)

  // ── 5. 自检 ──
  const chk = (await q(`
    SELECT (SELECT COUNT(*) FROM inh WHERE src=0 AND 单据编号=N'${NO}') AS 期初行数,
           (SELECT CAST(ISNULL(SUM(数量),0) AS decimal(18,4)) FROM inh WHERE src=0 AND 单据编号=N'${NO}') AS 期初数量,
           (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun行数,
           (SELECT CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') AS kucun余量,
           (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y' AND yl<0) AS kucun负结存行,
           (SELECT COUNT(*) FROM inh WHERE src=0 AND 物料名称 IS NULL) AS 未匹配物料,
           (SELECT COUNT(*) FROM inh WHERE 单据类型=N'月结结转') AS 残留结转行,
           (SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND src BETWEEN 1 AND 8 AND 单据日期<'${CUT}') AS 期初日前入,
           (SELECT COUNT(*) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期<'${CUT}') AS 期初日前出`))[0]
  log('')
  for (const [k, v] of Object.entries(chk)) log(`[自检] ${k} = ${v}`)

  // 结存 == Σ流水(与 InvCostService.reconcileStockOnStartup 同口径,含期初行)
  const recon = (await q(`
    SELECT COUNT(*) AS 不一致键数 FROM (
      SELECT ISNULL(a.k, b.k) AS k, ISNULL(a.net,0) AS net, ISNULL(b.yl,0) AS yl FROM
      (SELECT CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(批号,N'')) AS k, SUM(数量) AS net
         FROM (SELECT 物料编码,仓库编码,批号,数量 FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y'
               UNION ALL
               SELECT 物料编码,仓库编码,批号,-数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') s
        GROUP BY CONCAT(物料编码,N'|',ISNULL(RTRIM(仓库编码),N''),N'|',ISNULL(批号,N''))) a
      FULL OUTER JOIN
      (SELECT CONCAT(wzdm,N'|',ISNULL(RTRIM(ckdm),N''),N'|',ISNULL(lot_no,N'')) AS k, yl
         FROM kucun WHERE ISNULL(asp_cancel,'N')<>'Y') b ON a.k = b.k
      WHERE ABS(ISNULL(a.net,0) - ISNULL(b.yl,0)) > 0.0001
    ) x`))[0]
  log(`[自检] 结存 vs Σ流水 不一致键数 = ${recon.不一致键数}(应为 0,月结结转行除外)`)

  const warn = []
  if (Number(chk.期初行数) !== opening.length) warn.push(`期初行数 ${chk.期初行数} ≠ ${opening.length}`)
  if (Math.abs(Number(chk.期初数量) - openSum) > 0.01) warn.push('期初数量合计不符')
  if (Number(chk.残留结转行) !== 0) warn.push(`残留月结结转 ${chk.残留结转行} 行`)
  const expectRecon = Number(chk.残留结转行) > 0 ? -1 : 0
  if (expectRecon === 0 && Number(recon.不一致键数) !== 0)
    warn.push(`结存与流水不一致 ${recon.不一致键数} 键`)

  if (WRITE) {
    if (warn.length) {
      await tx.rollback()
      console.error('\n❌ 自检未通过,已回滚:\n  ' + warn.join('\n  '))
      process.exitCode = 1
    } else {
      await tx.commit()
      log('\n✅ 已提交')
    }
  } else {
    await tx.rollback()
    log('\n↩ dry-run:已 ROLLBACK')
    log(warn.length ? '   ⚠ ' + warn.join(' / ') : '   ✅ 预演自检全部通过')
  }
} catch (e) {
  try { await tx.rollback() } catch {}
  console.error('❌ 失败,已回滚:', e.message)
  process.exitCode = 1
} finally {
  await pool.close()
}
