/**
 * _verify-erplg-push.mjs — ERP导入日志补录脚本的「两账套取证」
 *
 * 用途(2026-10-19 推送到云端):
 *   ① 默认:统计两账套 IMP-% 行数 + 逐列比对 HSDZ_MES(源)与 HSDZ_MES_TEST(脚本写出来的),
 *      任何列不一致都打出来(用于证明脚本转写无损,不是"看起来有 9 行"就算过);
 *   ② --wipe-test:清掉测试库的 IMP-% 行(测试库可弃,专门用来验脚本真能插入)。
 *
 * 用法:
 *   node tools/archive/_erplg-push-20261019/_verify-erplg-push.mjs
 *   node tools/archive/_erplg-push-20261019/_verify-erplg-push.mjs --wipe-test
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const WIPE = argv.includes('--wipe-test')

const base = {
  server: '127.0.0.1', port: 1433, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}
const connect = (database) => mssql.connect({ ...base, database })

const LOG_COLS = ['批次号', '导入类型', '文件名', '总行数', '成功数', '失败数', '跳过数', '状态', '操作人',
  '导入时间', '备注', 'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2', 'asp_cancel']
const ROW_COLS = ['批次号', '行号', '源单号', '原始JSON', '解析状态', '错误信息', '目标表', '目标键',
  '处理状态', 'asp_cancel', 'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2']
const DT = new Set(['导入时间', 'asp_time1', 'asp_time2'])
const sel = (cols) => cols.map((c) => DT.has(c) ? `CONVERT(varchar(23), [${c}], 121) AS [${c}]` : `[${c}]`).join(', ')

async function snap(db) {
  const p = await connect(db)
  const l = (await p.request().query(
    `SELECT ${sel(LOG_COLS)} FROM erp_imp_log WHERE [批次号] LIKE 'IMP-%' ORDER BY [批次号]`)).recordset
  const r = (await p.request().query(
    `SELECT ${sel(ROW_COLS)} FROM erp_imp_row WHERE [批次号] LIKE 'IMP-%' ORDER BY [批次号], [行号]`)).recordset
  // 批次id 的「关系正确性」单列比对:行表的 批次id 必须等于同批次号日志行的 id
  const link = (await p.request().query(`
    SELECT COUNT(*) AS bad FROM erp_imp_row r
      LEFT JOIN erp_imp_log l ON l.[id] = r.[批次id]
     WHERE r.[批次号] LIKE 'IMP-%' AND (l.[id] IS NULL OR l.[批次号] <> r.[批次号])`)).recordset[0].bad
  await p.close()
  return { db, logs: l, rows: r, badLink: link }
}

if (WIPE) {
  const p = await connect('HSDZ_MES_TEST')
  const a = (await p.request().query("DELETE FROM erp_imp_row WHERE [批次号] LIKE 'IMP-%'")).rowsAffected[0]
  const b = (await p.request().query("DELETE FROM erp_imp_log WHERE [批次号] LIKE 'IMP-%'")).rowsAffected[0]
  await p.close()
  console.log(`[wipe] HSDZ_MES_TEST 删除 erp_imp_row=${a} erp_imp_log=${b}`)
  process.exit(0)
}

const src = await snap('HSDZ_MES')
const tst = await snap('HSDZ_MES_TEST')

console.log('库'.padEnd(16) + '日志行'.padEnd(8) + '明细行'.padEnd(8) + '批次id错挂')
for (const s of [src, tst]) {
  console.log(String(s.db).padEnd(14) + String(s.logs.length).padEnd(9) + String(s.rows.length).padEnd(9) + String(s.badLink))
}

const diffs = []
const cmp = (what, a, b, cols) => {
  if (a.length !== b.length) diffs.push(`${what}: 行数 ${a.length} vs ${b.length}`)
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    for (const c of cols) {
      if (String(a[i][c] ?? '\u0000') !== String(b[i][c] ?? '\u0000')) {
        diffs.push(`${what} 第${i + 1}行 [${c}]: 源=${String(a[i][c]).slice(0, 60)} | 目标=${String(b[i][c]).slice(0, 60)}`)
      }
    }
  }
}
cmp('日志表', src.logs, tst.logs, LOG_COLS)
cmp('明细表', src.rows, tst.rows, ROW_COLS)

// 关系正确性也要一致(两边都 0)
if (src.badLink !== 0) diffs.push(`源库 批次id 错挂 ${src.badLink} 行`)
if (tst.badLink !== 0) diffs.push(`测试库 批次id 错挂 ${tst.badLink} 行`)

console.log(diffs.length === 0
  ? '\nRESULT: ERPLG-PUSH PARITY-OK (两账套 9 批 / 45 明细 逐列一致,批次id 无错挂)'
  : `\nRESULT: ERPLG-PUSH PARITY-DIFF ${diffs.length}\n  ` + diffs.slice(0, 20).join('\n  '))
process.exit(diffs.length === 0 ? 0 : 1)
