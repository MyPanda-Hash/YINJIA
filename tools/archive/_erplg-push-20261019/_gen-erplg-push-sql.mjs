/**
 * _gen-erplg-push-sql.mjs — 从本机库把「ERP导入日志」9 个批次(erp_imp_log 9 行 + erp_imp_row 45 行)
 * 生成**幂等补录迁移脚本** `tools/migrate-erplg-cloud-push-20261019.sql`,供云端服务器执行
 * (走部署的迁移链 / 或单独 DbSync run 一条)。
 *
 * 口径(2026-10-19 用户:「推送到云端」):
 *   · 数据源 = 本机 HSDZ_MES 现役行(不重算、不造数,备注/时间戳原样带过去);
 *   · 幂等 = 日志表按 [批次号]、行表按 ([批次号],[行号]) 判定,已存在整条跳过;
 *   · 只写这两张表,不碰任何业务表;表不存在则整段 SKIP(空库/结构未同步时不会炸);
 *   · 尾部 RAISERROR(severity 10) 打 RESULT 自检行(与既有迁移同一套路,DbSync 认 50000 为提示)。
 *
 * 用法: node tools/archive/_erplg-push-20261019/_gen-erplg-push-sql.mjs [--db HSDZ_MES] [--out 文件名]
 */
import { writeFileSync } from 'node:fs'
import mssql from '../../../deploy/node_modules/mssql/index.js'

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const OUT = arg('out', 'migrate-erplg-cloud-push-20261019.sql')

const LOG_COLS = ['批次号', '导入类型', '文件名', '总行数', '成功数', '失败数', '跳过数', '状态', '操作人',
  '导入时间', '备注', 'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2', 'asp_cancel']
const ROW_COLS = ['批次id', '批次号', '行号', '源单号', '原始JSON', '解析状态', '错误信息', '目标表', '目标键',
  '处理状态', 'asp_cancel', 'asp_user1', 'asp_time1', 'asp_user2', 'asp_time2']
const DT_COLS = new Set(['导入时间', 'asp_time1', 'asp_time2'])

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})

/** datetime 一律按「库里存的值」取字符串(CONVERT 121),避免 JS Date 的 UTC 偏移把 17:58 变 09:58 */
const sel = (cols) => cols.map((c) => DT_COLS.has(c) ? `CONVERT(varchar(23), [${c}], 121) AS [${c}]` : `[${c}]`).join(', ')
const logs = await pool.request().query(
  `SELECT [id], ${sel(LOG_COLS)} FROM erp_imp_log WHERE [批次号] LIKE 'IMP-%' ORDER BY [id]`)
const rows = await pool.request().query(
  `SELECT [id], ${sel(ROW_COLS)} FROM erp_imp_row WHERE [批次号] LIKE 'IMP-%' ORDER BY [批次号], [行号]`)
await pool.close()

const q = (v) => {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  return `N'${String(v).replace(/'/g, "''")}'`
}
const dt = (v) => (v === null || v === undefined ? 'NULL' : `'${v}'`)
const cell = (c, v) => (DT_COLS.has(c) ? dt(v) : q(v))

const byBatch = new Map()
for (const r of rows.recordset) {
  if (!byBatch.has(r['批次号'])) byBatch.set(r['批次号'], [])
  byBatch.get(r['批次号']).push(r)
}

const L = []
L.push('/* ==========================================================================')
L.push('   migrate-erplg-cloud-push-20261019.sql')
L.push('')
L.push('   ERP导入日志(ERPLG / ERPLG_ROW)补录 —— 把本机已登记的 9 个批次推到云端服务器。')
L.push('')
L.push('   背景(2026-10-19 用户口径「推送到云端」):')
L.push('     · 2026-10-18 按「去关联金蝶账号的数据写入,先把数据补充完整」补录过 9 个批次')
L.push('       (商品/仓库/计量单位/部门/职员/客户/供应商 + 采购订单/销售订单,合计 10710 行;')
L.push('        取证见 tools/archive/_dm-20261018/README.md),但那是本机脚本直接写库,')
L.push('       **从未进过迁移链**,所以云端服务器(36.140.66.163)上 ERPLG 至今 0 行。')
L.push('     · 本脚本把同样的 9 个批次做成**幂等补录**:走部署迁移链(或 DbSync run 单跑)即上云。')
L.push('')
L.push('   铁律:')
L.push('     ① 数据 = 本机现役行的原样转写(批次号/条数/备注/时间戳都不重算、不造数);')
L.push('     ② 幂等:日志表按 [批次号]、行表按 ([批次号],[行号]) 判定 —— 重跑 0 新增,不会重复;')
L.push('     ③ 只写 erp_imp_log / erp_imp_row 两张表;两张表不在(空库/结构未同步)整段 SKIP;')
L.push('     ④ 尾部打印 RESULT: 行数自检,期望 log=9 / row=45。')
L.push('')
L.push('   回退:DELETE FROM erp_imp_row WHERE [批次号] LIKE \'IMP-%\';')
L.push('         DELETE FROM erp_imp_log WHERE [批次号] LIKE \'IMP-%\';')
L.push('   ========================================================================== */')
L.push('SET NOCOUNT ON;')
L.push('')
L.push("IF OBJECT_ID(N'dbo.erp_imp_log', N'U') IS NOT NULL AND OBJECT_ID(N'dbo.erp_imp_row', N'U') IS NOT NULL")
L.push('BEGIN')
L.push('')
L.push(`    /* ── 日志表:${logs.recordset.length} 个批次 ── */`)

for (const lg of logs.recordset) {
  const no = lg['批次号']
  L.push(`    -- ${no} ${lg['导入类型']} / ${lg['总行数']} 行`)
  L.push(`    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_log WHERE [批次号] = N'${no}')`)
  L.push('        INSERT INTO dbo.erp_imp_log (' + LOG_COLS.map((c) => `[${c}]`).join(', ') + ')')
  L.push('        VALUES (' + LOG_COLS.map((c) => cell(c, lg[c])).join(', ') + ');')
  L.push('')
}

L.push('    /* ── 行表明细:按 [批次号] 取回各批次 id,再逐行补 ── */')
for (const lg of logs.recordset) {
  const no = lg['批次号']
  const v = 'b' + String(no).replace(/\D/g, '') // 变量名只用数字,如 b20261018001
  L.push(`    DECLARE @${v} INT = (SELECT [id] FROM dbo.erp_imp_log WHERE [批次号] = N'${no}');`)
}
L.push('')
for (const lg of logs.recordset) {
  const no = lg['批次号']
  const v = 'b' + String(no).replace(/\D/g, '')
  const list = byBatch.get(no) || []
  L.push(`    -- ${no} 明细 ${list.length} 行`)
  for (const r of list) {
    L.push(`    IF NOT EXISTS (SELECT 1 FROM dbo.erp_imp_row WHERE [批次号] = N'${no}' AND [行号] = ${r['行号']})`)
    L.push('        INSERT INTO dbo.erp_imp_row (' + ROW_COLS.map((c) => `[${c}]`).join(', ') + ')')
    const vals = ROW_COLS.map((c) => (c === '批次id' ? `@${v}` : cell(c, r[c])))
    L.push('        VALUES (' + vals.join(', ') + ');')
  }
  L.push('')
}

L.push('    /* ── 自检:期望 log=9 / row=45 ── */')
L.push("    DECLARE @logN INT = (SELECT COUNT(*) FROM dbo.erp_imp_log WHERE [批次号] LIKE 'IMP-20261018-%');")
L.push("    DECLARE @rowN INT = (SELECT COUNT(*) FROM dbo.erp_imp_row WHERE [批次号] LIKE 'IMP-20261018-%');")
L.push("    RAISERROR('RESULT: ERPLG-PUSH log=%d row=%d (expect 9 / 45)', 10, 1, @logN, @rowN) WITH NOWAIT;")
L.push('END')
L.push('ELSE')
L.push("    RAISERROR('RESULT: ERPLG-PUSH SKIPPED (erp_imp_log / erp_imp_row not found)', 10, 1) WITH NOWAIT;")
L.push('')

const sql = L.join('\n')
writeFileSync(new URL('../../' + OUT, import.meta.url), sql, 'utf8')
console.log(`generated ${OUT} from ${DB}: log=${logs.recordset.length} row=${rows.recordset.length}, bytes=${Buffer.byteLength(sql, 'utf8')}`)
