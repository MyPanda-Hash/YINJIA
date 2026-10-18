/**
 * 期初导入器 —— 把金蝶 2026-08-31 结存(方案A)写成 MES 的期初
 *
 * ── 口径 ──
 * 数据源:_out/opening-A-0831.json(由 _prepare-opening-ab.mjs 从 /jdy/v2/scm/inventory?point_date=2026-08-31 取)
 * 写入:
 *   ① inh  期初行:src=0 / rid=NULL / 单据编号='INIT-20260831' / 单据类型='期初结存'
 *                  / 单据日期='1900-01-01'(哨兵,必须早于一切业务) / 经手人=asp_user1='migration'
 *      —— 与既有 INIT-20261014 那批期初行**同形**(migrate-stock-flow-opening-2026-09-30 的口径)
 *   ② kucun 同键有则改、无则增;yl=期初数量,rkl=ckl=0
 *      —— 两处必须同时写,否则启动自检「结存 == Σ流水」(InvCostService.reconcileStockOnStartup)会报警
 *
 * ── 会先清掉的旧期初(否则双计)──
 *   · inh 中 src=0 的全部行(INIT-20261003 / INIT-20261014 …)
 *   · inh 中 单据类型='月结结转' 的结转行(JZ-202609)
 *   · kucun 整表(期初是台账的起点,整表重建)
 * 清理前把 inh 旧期初行 + kucun 全表备份成 CSV 落到 _out/。
 *
 * ── 用法 ──
 *   node tools/archive/_kd-opening-probe/_import-opening.mjs --db HSDZ_MES_TEST          # dry-run(事务内跑完自检后 ROLLBACK)
 *   node tools/archive/_kd-opening-probe/_import-opening.mjs --db HSDZ_MES_TEST --write  # 真写
 */
import { readFileSync, writeFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES_TEST')
const WRITE = argv.includes('--write')
const NO = arg('no', 'INIT-20260831')
const TAG = DB === 'HSDZ_MES' ? 'prod' : 'test'

const opening = JSON.parse(readFileSync(new URL('./_out/opening-A-0831.json', import.meta.url), 'utf8'))
  .filter((r) => Math.abs(r.qty) > 0.00001)
console.log(`[读入] 期初 ${opening.length} 行 · 合计 ${opening.reduce((s, r) => s + r.qty, 0).toFixed(4)}`)
console.log(`[模式] ${WRITE ? '★写入' : 'dry-run(事务末尾 ROLLBACK)'}  账套 ${DB}  单号 ${NO}`)

const pool = await mssql.connect({ server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true } })
const tx = new mssql.Transaction(pool)
await tx.begin()
const q = async (sql) => (await new mssql.Request(tx).query(sql)).recordset
const log = (s) => console.log(s)

try {
  // ── 0. 备份 ──
  const oldInit = await q(`SELECT * FROM inh WHERE src = 0 OR 单据类型 = N'月结结转'`)
  const oldKucun = await q(`SELECT * FROM kucun`)
  const csvOf = (rows) => {
    if (!rows.length) return ''
    const cols = Object.keys(rows[0])
    const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    return [cols.join(',')].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(','))).join('\n')
  }
  writeFileSync(new URL(`./_out/backup-inh-init-before-${TAG}.csv`, import.meta.url), csvOf(oldInit), 'utf8')
  writeFileSync(new URL(`./_out/backup-kucun-before-${TAG}.csv`, import.meta.url), csvOf(oldKucun), 'utf8')
  log(`[备份] inh 旧期初/结转 ${oldInit.length} 行 · kucun ${oldKucun.length} 行 → _out/backup-*-before-${TAG}.csv`)

  // ── 1. 清旧期初 ──
  const delInit = await q(`DELETE FROM inh WHERE src = 0 OR 单据类型 = N'月结结转'; SELECT @@ROWCOUNT AS n`)
  log(`[清理] 删 inh 旧期初/结转 ${delInit[0].n} 行`)
  const delKucun = await q(`DELETE FROM kucun; SELECT @@ROWCOUNT AS n`)
  log(`[清理] 清 kucun ${delKucun[0].n} 行`)

  // ── 2. 写 inh 期初行(用 VALUES 派生表,扁平化传入)──
  const esc = (s) => (s == null ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`)
  const CHUNK = 500
  let insInh = 0
  for (let i = 0; i < opening.length; i += CHUNK) {
    const part = opening.slice(i, i + CHUNK)
    const VALUES = part.map((r) => `(${esc(r.wzdm)},${esc(r.ckdm)},${esc(r.lot)},CAST(${Number(r.qty)} AS decimal(18,4)))`).join(',')
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

  // ── 3. 写 kucun(整表重建)──
  const kc = await q(`
    INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, price, asp_user1, asp_time1, asp_cancel)
    SELECT 物料编码, 仓库编码, 批号, GETDATE(), 0, 0, 数量, NULL, N'期初导入', GETDATE(), 'N'
      FROM inh WHERE src = 0 AND 单据编号 = N'${NO}';
    SELECT @@ROWCOUNT AS n`)
  log(`[写入] kucun ${kc[0].n} 行`)

  // ── 4. 自检 ──
  const chk = (await q(`
    SELECT (SELECT COUNT(*) FROM inh WHERE src = 0 AND 单据编号 = N'${NO}') AS 期初行数,
           (SELECT CAST(ISNULL(SUM(数量),0) AS decimal(18,4)) FROM inh WHERE src = 0 AND 单据编号 = N'${NO}') AS 期初数量,
           (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') AS kucun行数,
           (SELECT CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y') AS kucun余量,
           (SELECT COUNT(*) FROM kucun WHERE ISNULL(asp_cancel,'N') <> 'Y' AND yl < 0) AS kucun负结存行,
           (SELECT COUNT(*) FROM inh WHERE src = 0 AND 物料名称 IS NULL) AS 未匹配物料档案,
           (SELECT COUNT(*) FROM inh WHERE src = 0 AND 仓库名称 IS NULL) AS 未匹配仓库档案,
           (SELECT COUNT(*) FROM inh WHERE 单据类型 = N'月结结转') AS 残留结转行`))[0]
  log('')
  for (const [k, v] of Object.entries(chk)) log(`[自检] ${k} = ${v}`)

  // 结存 == Σ流水(只比 MES 已记账的支出:inh 里 src 1..8 的真实业务流水,不含期初自身)
  // ⚠ 期初是台账的起点,kucun 的 yl 就等于期初数量;这里验的是「除期初外还有没有别的流水」
  //   把 kucun 顶歪(测试库如果还留着真实单据流水,这里会非 0 —— 那是预期,不是导入失败)。
  // ⚠ 用 CONCAT + 独立派生表(不在子查询里写中文字符串拼接,避免排序规则/别名解析问题)
  const recon = (await q(`
    SELECT COUNT(*) AS 非期初流水键数, CAST(ISNULL(SUM(ABS(net)),0) AS decimal(18,4)) AS 非期初流水净额
      FROM (SELECT CONCAT(物料编码, N'|', ISNULL(RTRIM(仓库编码),N''), N'|', ISNULL(批号,N'')) AS k,
                   SUM(数量) AS net
              FROM (SELECT 物料编码, 仓库编码, 批号, 数量 FROM inh
                     WHERE ISNULL(asp_cancel,'N') <> 'Y' AND src BETWEEN 1 AND 8
                    UNION ALL
                    SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
                     WHERE ISNULL(asp_cancel,'N') <> 'Y') i
             GROUP BY CONCAT(物料编码, N'|', ISNULL(RTRIM(仓库编码),N''), N'|', ISNULL(批号,N''))) a
     WHERE ABS(net) > 0.0001`))[0]
  log(`[自检] 期初之外的真实流水键数 = ${recon.非期初流水键数}(>0 表示该库还留着业务单据流水,结存会与期初不同)`)

  const warn = []
  if (Number(chk.期初行数) !== opening.length) warn.push(`期初行数 ${chk.期初行数} ≠ 期望 ${opening.length}`)
  if (Math.abs(Number(chk.期初数量) - opening.reduce((s, r) => s + r.qty, 0)) > 0.01)
    warn.push(`期初数量合计 ${chk.期初数量} ≠ 期望 ${opening.reduce((s, r) => s + r.qty, 0).toFixed(4)}`)
  if (Number(chk.kucun行数) !== opening.length) warn.push(`kucun 行数 ${chk.kucun行数} ≠ 期初行数 ${opening.length}`)
  if (Math.abs(Number(chk.kucun余量) - Number(chk.期初数量)) > 0.01) warn.push('kucun 余量合计 ≠ 期初数量合计')
  if (Number(chk.残留结转行) !== 0) warn.push(`仍有月结结转行 ${chk.残留结转行}`)
  // 注意:「期初之外还有真实流水」不是错误——正式库必然有 9/1 之后的单据流水,
  //   那时 kucun 由期初 + 这些流水共同决定,不能再要求"kucun == 期初"。只作信息提示。

  if (WRITE) {
    if (warn.length) {
      await tx.rollback()
      console.error('\n❌ 自检未通过,**已回滚,未写入**:\n  ' + warn.join('\n  '))
      process.exitCode = 1
    } else {
      await tx.commit()
      log('\n✅ 已提交')
      log('   下一步:重启后端触发成本重算(启动自检 reconcileOnStartup),或调「重算成本」按钮')
    }
  } else {
    await tx.rollback()
    log('\n↩ dry-run:已 ROLLBACK,数据未改')
    if (warn.length) log('   ⚠ 预演发现:' + warn.join(' / ') + '(真写时会被拦下)')
    else log('   ✅ 预演自检全部通过,可加 --write 执行')
  }
} catch (e) {
  try { await tx.rollback() } catch {}
  console.error('❌ 失败,已回滚:', e.message)
  process.exitCode = 1
} finally {
  await pool.close()
}
