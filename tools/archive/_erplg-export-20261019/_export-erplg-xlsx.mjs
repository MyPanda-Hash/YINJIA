/**
 * _export-erplg-xlsx.mjs — 导出「ERP导入日志」→ Excel(.xlsx),随仓库推送到云端(2026-10-19)
 *
 * 【背景/口径】
 *   用户口径:「erp导入日志的数据是否有推送到云端」→「推送到云端」→「写成 excel 表格推送到云端就行」。
 *   云端服务器(36.140.66.163)的 ERPLG 至今 0 行:2026-10-18 那 9 个批次是本机脚本直写库
 *   (tools/archive/_dm-20261018/),从未进过迁移链;用户选定**做成 Excel 随仓库上云**,不动服务器库。
 *
 * 【数据源】正式账套 HSDZ_MES · dbo.erp_imp_log(9 行) + dbo.erp_imp_row(45 行)。
 *   测试账套是正式库快照副本,同一份数据,不重复导出。
 *
 * 【产物】db/erplg-data-20261019/ERP导入日志-20261019.xlsx,四个页签:
 *   · 「ERP导入日志」= 面板 ERPLG 可见字段(yj_field.seq 顺序 = 界面顺序),9 行
 *   · 「导入明细」   = 面板 ERPLG_ROW 可见字段,45 行
 *   · 「字段说明」   = 列名 / 显示名 / 类型 / 非空行数 / 在面板
 *   · 「说明」       = 这批数据是什么、从哪来、为什么是空的云端库、怎么回导
 *
 * 【红线】`原始JSON` 列(45 段金蝶原始报文,含客户/供应商名称与金额)**不导出**:
 *   `MyPanda-Hash/YINJIA` 是**公开仓库**(2026-10-19 未登录访问 = 200),原始报文属客户业务数据,
 *   与 2026-10-18 职员档案「脱敏后推送」同一口径 —— 面板卡片上看得到的字段才进表。
 *   需要在本地看原始报文,直接查 erp_imp_row.原始JSON,或跑 _export-erplg-xlsx.mjs --with-json
 *   导到仓库外的目录(默认产物不带)。
 *
 * 【自检】写完回读 xlsx:页签齐全 / 行数 / 表头顺序 / 原始JSON 未泄漏 / 关键值抽查。
 *
 * 用法: node tools/archive/_erplg-export-20261019/_export-erplg-xlsx.mjs [--db HSDZ_MES] [--with-json]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const XLSX = require('../../../frontend/node_modules/xlsx')

const argv = process.argv.slice(2)
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const WITH_JSON = argv.includes('--with-json') // 仅本地用:产物会含客户/供应商原始报文,禁止入库
const STAMP = '20261019'
const OUT_DIR = fileURLToPath(new URL(arg('out', `../../../db/erplg-data-${STAMP}/`), import.meta.url))
const OUT_FILE = OUT_DIR + `ERP导入日志-${STAMP}${WITH_JSON ? '-含原始JSON' : ''}.xlsx`

const DATETIME_TYPES = new Set(['datetime', 'datetime2', 'smalldatetime', 'date', 'datetimeoffset', 'time'])
const PUBLIC_OMIT = new Set(['原始JSON']) // 公开仓库不外发

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

const physCols = async (table) => q(`
  SELECT c.column_id AS id, c.name, t.name AS type, c.max_length AS len
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.${table}') ORDER BY c.column_id`)

const selectList = (cols) => cols.map((c) => {
  const n = `[${c.name}]`
  if (DATETIME_TYPES.has(c.type)) return `CONVERT(varchar(19), ${n}, 120) AS ${n}`
  if (['char', 'nchar', 'varchar', 'nvarchar'].includes(c.type)) return `RTRIM(${n}) AS ${n}`
  return n
}).join(', ')

const logCols = await physCols('erp_imp_log')
const rowCols = await physCols('erp_imp_row')
const logs = await q(`SELECT ${selectList(logCols)} FROM dbo.erp_imp_log ORDER BY id`)
const rows = await q(`SELECT ${selectList(rowCols)} FROM dbo.erp_imp_row ORDER BY [批次号], [行号]`)

const panelFields = async (code) => (await q(`
  SELECT col_name, label, place, seq, data_type, visible, hidden
  FROM yj_field WHERE panel_code = '${code}' ORDER BY seq, id`))
  .filter((f) => f.visible !== false && !f.hidden)
const fLog = await panelFields('ERPLG')
const fRow = (await panelFields('ERPLG_ROW')).filter((f) => WITH_JSON || !PUBLIC_OMIT.has(f.col_name))

const val = (v) => (v === null || v === undefined ? '' : v)
const sheetOf = (fields, data) => {
  const out = [fields.map((f) => f.label)]
  for (const r of data) out.push(fields.map((f) => val(r[f.col_name])))
  return out
}
const sheetLog = sheetOf(fLog, logs)
const sheetRow = sheetOf(fRow, rows)

// ── 页签 3「字段说明」 ──
const docSheet = [['页签', '列名', '显示名', '类型', '非空行数', '在面板', '公开仓库外发']]
const addDoc = (sheet, fields, phys, data) => {
  const inPanel = new Set(fields.map((f) => f.col_name))
  const labelOf = new Map((fields || []).map((f) => [f.col_name, f.label]))
  const labels = new Map()
  // 显示名从「两侧面板字段」里找(被 PUBLIC_OMIT 剔掉的列也能标出中文名)
  for (const f of [...fLog, ...fRow]) labels.set(f.col_name, f.label)
  for (const c of phys) {
    const n = data.filter((r) => String(val(r[c.name])).trim() !== '').length
    docSheet.push([sheet, c.name, labels.get(c.name) || labelOf.get(c.name) || '', c.type, n,
      inPanel.has(c.name) ? '是' : '否', PUBLIC_OMIT.has(c.name) ? '否' : '是'])
  }
}
addDoc('ERP导入日志', fLog, logCols, logs)
addDoc('导入明细', fRow, rowCols, rows)

// ── 页签 4「说明」 ──
const tips = [
  ['项目', '内容'],
  ['这批数据是什么', '2026-10-18 按「去关联金蝶账号的数据写入,先把数据补充完整」补录的 9 个导入批次(基础档案 7 类 + 采购订单/销售订单)'],
  ['批次清单', 'IMP-20261018-001..009,合计 10,710 行;明细页签 45 行 = 每批取金蝶首页 5 条真实单号/编码作凭据'],
  ['数据来源', `本机正式账套 ${DB} · dbo.erp_imp_log / dbo.erp_imp_row(由本机脚本直写,不是同步流水)`],
  ['云端服务器现状', '服务器(36.140.66.163)上 ERPLG 仍为 0 行:这批数据从未进过迁移链,也没走部署'],
  ['本文件用途', '供同事拉取后直接打开查看,不必连库;不是回导用的数据文件'],
  ['为什么不带原始JSON', `erp_imp_row.原始JSON(45 段金蝶报文,含客户/供应商名称与金额)不导出 —— 仓库 ${'MyPanda-Hash/YINJIA'} 为公开仓库,按 2026-10-18 职员档案「脱敏后推送」同一口径处理;要看报文请查库`],
  ['界面只读口径', 'ERP导入日志(ERPLG/ERPLG_ROW)是只读面板:任何新增/保存/删除按钮一律 403(PanelPermissionService.READONLY_PANELS)'],
  ['生成方式', 'node tools/archive/_erplg-export-20261019/_export-erplg-xlsx.mjs'],
]
const wsTips = XLSX.utils.aoa_to_sheet(tips)

// ══════════ 写 xlsx ══════════
const wb = XLSX.utils.book_new()
const width = (fields) => fields.map((f) => ({ wch: Math.max(8, Math.min(28, String(f.label || '').length * 2 + 6)) }))

const ws1 = XLSX.utils.aoa_to_sheet(sheetLog)
ws1['!cols'] = width(fLog)
ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheetLog.length - 1, c: fLog.length - 1 } }) }
XLSX.utils.book_append_sheet(wb, ws1, 'ERP导入日志')

const ws2 = XLSX.utils.aoa_to_sheet(sheetRow)
ws2['!cols'] = width(fRow)
ws2['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheetRow.length - 1, c: fRow.length - 1 } }) }
XLSX.utils.book_append_sheet(wb, ws2, '导入明细')

const ws3 = XLSX.utils.aoa_to_sheet(docSheet)
ws3['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 14 }]
XLSX.utils.book_append_sheet(wb, ws3, '字段说明')

wsTips['!cols'] = [{ wch: 20 }, { wch: 96 }]
XLSX.utils.book_append_sheet(wb, wsTips, '说明')

mkdirSync(OUT_DIR, { recursive: true })
XLSX.writeFile(wb, OUT_FILE)

// ══════════ 回读自检 ══════════
const back = XLSX.readFile(OUT_FILE)
const read = (n) => XLSX.utils.sheet_to_json(back.Sheets[n], { header: 1, defval: '' })
const r1 = read('ERP导入日志'), r2 = read('导入明细'), r3 = read('字段说明'), r4 = read('说明')
const checks = []
const ck = (ok, what, detail) => { checks.push({ ok, what, detail }); console.log(`${ok ? '[PASS]' : '[FAIL]'} ${what}${detail ? ' — ' + detail : ''}`) }

ck(back.SheetNames.join(',') === 'ERP导入日志,导入明细,字段说明,说明', '页签齐全', back.SheetNames.join(','))
ck(r1.length - 1 === logs.length, '「ERP导入日志」数据行数 = erp_imp_log 行数', `${r1.length - 1} / ${logs.length}`)
ck(r2.length - 1 === rows.length, '「导入明细」数据行数 = erp_imp_row 行数', `${r2.length - 1} / ${rows.length}`)
ck(r1[0].join(',') === fLog.map((f) => f.label).join(','), '「ERP导入日志」表头 = 面板 yj_field.seq 顺序', r1[0].join(' / '))
ck(r2[0].join(',') === fRow.map((f) => f.label).join(','), '「导入明细」表头 = 面板 yj_field.seq 顺序', r2[0].join(' / '))
ck(r1.length - 1 === 9 && r2.length - 1 === 45, '行数与 2026-10-18 补录口径一致(9 批 / 45 明细)', `${r1.length - 1} / ${r2.length - 1}`)
ck(r1[0].includes('批次号') && r1[0].includes('总行数'), '关键列在位(批次号 / 总行数)', r1[0].join(','))

// 批次号全部是 IMP- 前缀,且总和 = 10710
const batchNos = r1.slice(1).map((x) => String(x[r1[0].indexOf('批次号')] ?? ''))
ck(batchNos.length === 9 && batchNos.every((s) => s.startsWith('IMP-20261018-')), '批次号 = IMP-20261018-001..009', batchNos.join(','))
const sumIdx = r1[0].indexOf('总行数')
const total = r1.slice(1).reduce((a, x) => a + Number(x[sumIdx] || 0), 0)
ck(total === 10710, '总行数合计 = 10,710(与补录口径一致)', String(total))

// 公开仓库红线:不得出现原始 JSON 报文(特征串) 与手机号/身份证号
//
// ⚠ 身份证号不能用「18 位数字」判 —— 金蝶**实例ID 就是 18 位**(580147507460444160),
//   2026-10-19 首跑就被这个假阳性挡下(与 2026-10-18 职员那次「19 位雪花号被当身份证」同源)。
//   改法:18 位候选再过 **GB 11643 校验位**,校验不过的一律不判 PII。
const ID_WEIGHT = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const ID_CHECK = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
const isIdCard = (s) => {
  if (!/^\d{17}[\dXx]$/.test(s)) return false
  // 出生日期须是真日期(1900..今天):金蝶 18 位实例ID「580147507460444160」校验位**碰巧**能过,
  // 只有日期这一关能把它挡下(第 7~14 位 = 50746044,不是日期)。
  const y = Number(s.slice(6, 10)), mo = Number(s.slice(10, 12)), d = Number(s.slice(12, 14))
  if (y < 1900 || y > new Date().getFullYear()) return false
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return false
  let sum = 0
  for (let i = 0; i < 17; i++) sum += Number(s[i]) * ID_WEIGHT[i]
  return ID_CHECK[sum % 11] === s[17].toUpperCase()
}
const PHONE = /(?<!\d)1[3-9]\d{9}(?!\d)/
const IDLIKE = /(?<!\d)(\d{17}[\dXx])(?!\d)/g
const JSON_LEAK = [/"bill_no"\s*:/, /"parent_id"\s*:/, /"bill_dis_amount"\s*:/]
const leaks = []
if (!WITH_JSON) {
  for (const [name, sheet] of [['ERP导入日志', r1], ['导入明细', r2], ['字段说明', r3], ['说明', r4]]) {
    for (let i = 1; i < sheet.length; i++) for (let j = 0; j < sheet[i].length; j++) {
      const s = String(sheet[i][j] ?? '')
      if (PHONE.test(s)) leaks.push(`${name}!${i + 1},${j + 1} 手机号=${s.slice(0, 40)}`)
      if (JSON_LEAK.some((re) => re.test(s))) leaks.push(`${name}!${i + 1},${j + 1} 原始JSON=${s.slice(0, 40)}`)
      for (const m of s.matchAll(IDLIKE)) if (isIdCard(m[1])) leaks.push(`${name}!${i + 1},${j + 1} 身份证=${m[1]}`)
    }
  }
  ck(leaks.length === 0, '公开仓库红线:无原始JSON报文 / 无手机号 / 无身份证号(校验位判定)', leaks.length ? leaks.slice(0, 5).join(' | ') : '0 处')
}
ck(!r2[0].includes('原始JSON'), '「导入明细」不含 原始JSON 列', WITH_JSON ? '(本次 --with-json,本地用,禁止入库)' : '已剔')

const failed = checks.filter((c) => !c.ok)
console.log(`\n[产物] ${OUT_FILE}`)
console.log(`[汇总] 日志 ${logs.length} 行 / 明细 ${rows.length} 行 / 面板字段 ${fLog.length} + ${fRow.length} 个`)
console.log(failed.length ? `\n❌ ${failed.length} 项 [FAIL]` : '\n✅ 全部 [PASS]')

writeFileSync(OUT_DIR + `_export-summary${WITH_JSON ? '-with-json' : ''}.json`, JSON.stringify({
  generatedAt: new Date().toISOString(), database: DB,
  tables: { erp_imp_log: logs.length, erp_imp_row: rows.length },
  panelFields: { ERPLG: fLog.map((f) => f.label), ERPLG_ROW: fRow.map((f) => f.label) },
  omitted: [...PUBLIC_OMIT], withJson: WITH_JSON, failed: failed.map((f) => f.what),
}, null, 2), 'utf8')

await pool.close()
if (failed.length) process.exit(1)
