/**
 * 导出「职员档案」→ Excel(.xlsx),随仓库推送到云端(2026-10-18)
 *
 * 【背景/口径】
 *   用户口径:「将职员的数据打包成 excel 推送到云端仓库」。
 *   2026-10-18 已确认 `MyPanda-Hash/YINJIA` 是**公开仓库**(未登录访问首页 = 200),
 *   而 bs_emp 有真实姓名 + 35 个手机号 ⇒ 用户选定**脱敏后推送**:
 *     · 手机 / 办公电话 → 保留前 3 后 4(`134****9309`)
 *     · 证件号码        → 保留前 4 后 4,中间变 `*`
 *     · 邮箱            → 域名保留,账号名首字符 + `***`
 *     · 微信            → 首字符 + `***` + 末字符
 *   其余字段(编码/姓名/部门/性别/状态/备注…)原样,不做翻译、不做改写。
 *
 * 【数据源】正式账套 HSDZ_MES · dbo.bs_emp(面板 EMP「职员」,基础档案,主键 id)。
 *   测试账套是正式库快照副本,同一份档案,不重复导出。
 *
 * 【产物】db/emp-data-20261018/职员档案-20261018.xlsx,三个页签:
 *   · 「职员」     = 面板可见字段(按 yj_field.seq,id 排序,即界面上的顺序)
 *   · 「全字段」   = bs_emp 全部物理列(列名即物理列名,便于回导)
 *   · 「字段说明」 = 列名 / 显示名 / 类型 / 非空行数 / 是否在面板 / 是否脱敏
 *
 * 【自检】导出后重新读回 xlsx:行数、表头、以及**脱敏残留扫描**
 *   (单元格里出现 `1[3-9]\d{9}` 或 18 位身份证号即 [FAIL])。
 *
 * 用法: node tools/archive/_emp-export-20261018/_export-emp-xlsx.mjs [--db HSDZ_MES] [--out <dir>]
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
const STAMP = '20261018'
const OUT_DIR = fileURLToPath(new URL(arg('out', `../../../db/emp-data-${STAMP}/`), import.meta.url))
const OUT_FILE = OUT_DIR + `职员档案-${STAMP}.xlsx`

// ══════════ 脱敏 ══════════
const MASKED_COLS = new Set(['手机', '办公电话', '证件号码', '邮箱', '微信'])
const keep = (s, n) => s.slice(0, n)
const tail = (s, n) => (n > 0 ? s.slice(-n) : '')
const maskPhone = (s) => {
  const t = String(s).trim()
  const d = t.replace(/\D/g, '')
  if (d.length < 7) return d ? '****' : ''
  return keep(d, 3) + '****' + tail(d, 4)
}
const maskIdNo = (s) => {
  const t = String(s).trim()
  if (!t) return ''
  if (t.length <= 8) return '****'
  return keep(t, 4) + '*'.repeat(t.length - 8) + tail(t, 4)
}
const maskEmail = (s) => {
  const t = String(s).trim()
  if (!t) return ''
  const at = t.lastIndexOf('@')
  if (at <= 0) return maskIdNo(t)
  return keep(t, 1) + '***' + t.slice(at)
}
const maskWechat = (s) => {
  const t = String(s).trim()
  if (!t) return ''
  if (t.length <= 2) return '***'
  return keep(t, 1) + '***' + tail(t, 1)
}
const MASKERS = { 手机: maskPhone, 办公电话: maskPhone, 证件号码: maskIdNo, 邮箱: maskEmail, 微信: maskWechat }
const mask = (col, v) => (MASKERS[col] && v !== null && v !== undefined ? MASKERS[col](v) : v)

// ══════════ 类型口径 ══════════
const DATETIME_TYPES = new Set(['datetime', 'datetime2', 'smalldatetime', 'date', 'datetimeoffset', 'time'])
const BIT_LABEL = { true: '是', false: '否' }

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
})
const q = async (sql) => (await pool.request().query(sql)).recordset

// 物理列(datetime/char 交给服务器侧转字符串,避免 JS Date 的时区漂移与 char 尾空格)
const cols = await q(`
  SELECT c.column_id AS id, c.name, t.name AS type, c.max_length AS len
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID('dbo.bs_emp') ORDER BY c.column_id`)
const selectList = cols.map((c) => {
  const n = `[${c.name}]`
  if (DATETIME_TYPES.has(c.type)) return `CONVERT(varchar(19), ${n}, 120) AS ${n}`
  if (c.type === 'char' || c.type === 'nchar' || c.type === 'varchar' || c.type === 'nvarchar') return `RTRIM(${n}) AS ${n}`
  return n
})
const rows = await q(`SELECT ${selectList.join(', ')} FROM dbo.bs_emp ORDER BY id`)

// 面板字段(界面顺序 = seq 升序、同 seq 按 id;只看可见且未隐藏的)
const fields = await q(`
  SELECT col_name, label, place, seq, data_type, visible, hidden
  FROM yj_field WHERE panel_code = 'EMP' ORDER BY seq, id`)
const visibleFields = fields.filter((f) => f.visible !== false && !f.hidden)

const cell = (col, v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return BIT_LABEL[v] ?? ''
  return MASKED_COLS.has(col) ? mask(col, v) : v
}

// ── 页签 1「职员」:面板可见字段 ──
const sheetPanel = [visibleFields.map((f) => f.label)]
for (const r of rows) sheetPanel.push(visibleFields.map((f) => cell(f.col_name, r[f.col_name])))

// ── 页签 2「全字段」:物理列原样(表头 = 物理列名) ──
const sheetAll = [cols.map((c) => c.name)]
for (const r of rows) sheetAll.push(cols.map((c) => cell(c.name, r[c.name])))

// ── 页签 3「字段说明」 ──
const nonEmpty = {}
for (const c of cols) nonEmpty[c.name] = rows.filter((r) => String(cell(c.name, r[c.name]) ?? '').trim() !== '').length
const inPanel = new Set(fields.map((f) => f.col_name))
const labelOf = new Map(fields.map((f) => [f.col_name, f.label]))
const sheetDoc = [['列名', '显示名', '类型', '非空行数', '在面板', '脱敏']]
for (const c of cols) {
  sheetDoc.push([c.name, labelOf.get(c.name) || '', c.type, nonEmpty[c.name], inPanel.has(c.name) ? '是' : '否', MASKED_COLS.has(c.name) ? '是' : '否'])
}

// ══════════ 写 xlsx ══════════
const wb = XLSX.utils.book_new()

const ws1 = XLSX.utils.aoa_to_sheet(sheetPanel)
ws1['!cols'] = visibleFields.map((f) => ({ wch: Math.max(8, Math.min(24, (f.label || '').length * 2 + 6)) }))
ws1['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: sheetPanel.length - 1, c: sheetPanel[0].length - 1 } }) }
XLSX.utils.book_append_sheet(wb, ws1, '职员')

const ws2 = XLSX.utils.aoa_to_sheet(sheetAll)
ws2['!cols'] = cols.map((c) => ({ wch: Math.max(8, Math.min(30, c.name.length * 2 + 4)) }))
XLSX.utils.book_append_sheet(wb, ws2, '全字段')

const ws3 = XLSX.utils.aoa_to_sheet(sheetDoc)
ws3['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 6 }]
XLSX.utils.book_append_sheet(wb, ws3, '字段说明')

mkdirSync(OUT_DIR, { recursive: true })
XLSX.writeFile(wb, OUT_FILE)

// ══════════ 回读自检 ══════════
const back = XLSX.readFile(OUT_FILE)
const readSheet = (name) => XLSX.utils.sheet_to_json(back.Sheets[name], { header: 1, defval: '' })
const r1 = readSheet('职员'), r2 = readSheet('全字段'), r3 = readSheet('字段说明')
const checks = []
const ck = (ok, what, detail) => { checks.push({ ok, what, detail }); console.log(`${ok ? '[PASS]' : '[FAIL]'} ${what}${detail ? ' — ' + detail : ''}`) }
ck(back.SheetNames.join(',') === '职员,全字段,字段说明', '页签齐全', back.SheetNames.join(','))
ck(r1.length - 1 === rows.length, '「职员」数据行数 = bs_emp 行数', `${r1.length - 1} / ${rows.length}`)
ck(r2.length - 1 === rows.length, '「全字段」数据行数 = bs_emp 行数', `${r2.length - 1} / ${rows.length}`)
ck(r1[0].length === visibleFields.length, '「职员」表头 = 面板可见字段数', `${r1[0].length} / ${visibleFields.length}`)
ck(r2[0].length === cols.length, '「全字段」表头 = 物理列数', `${r2[0].length} / ${cols.length}`)
ck(r1[0].join(',') === visibleFields.map((f) => f.label).join(','), '表头顺序 = yj_field.seq 顺序', r1[0].join(' / '))

// 脱敏残留扫描:任何单元格出现 11 位手机号或 18 位身份证号即失败。
// ⚠ 必须带数字边界(前后不接数字):金蝶 外部数据ID 是 19 位雪花号(如 2178314889490196480),
//   裸 `\d{17}` 会把它的子串误判成身份证号 —— 2026-10-18 首跑就是被这个假阳性挡下的。
const PII = [/(?<!\d)1[3-9]\d{9}(?!\d)/, /(?<!\d)\d{17}[\dXx](?!\d)/]
const leaks = []
for (const [name, sheet] of [['职员', r1], ['全字段', r2], ['字段说明', r3]]) {
  for (let i = 1; i < sheet.length; i++) for (let j = 0; j < sheet[i].length; j++) {
    const s = String(sheet[i][j] ?? '')
    for (const re of PII) if (re.test(s)) leaks.push(`${name}!${i + 1},${j + 1}=${s}`)
  }
}
ck(leaks.length === 0, 'PII 残留扫描(手机号/身份证号)', leaks.length ? leaks.slice(0, 5).join(' | ') : '0 处')
ck(rows.length > 0, 'bs_emp 非空', `${rows.length} 行`)

const failed = checks.filter((c) => !c.ok)
console.log(`\n[产物] ${OUT_FILE}`)
console.log(`[汇总] ${rows.length} 行 / 面板字段 ${visibleFields.length} 个 / 物理列 ${cols.length} 个`)
console.log(failed.length ? `\n❌ ${failed.length} 项 [FAIL]` : '\n✅ 全部 [PASS]')

// 交给 README 生成的摘要
writeFileSync(OUT_DIR + '_export-summary.json', JSON.stringify({
  generatedAt: new Date().toISOString(), database: DB, table: 'bs_emp', rows: rows.length,
  panelFields: visibleFields.map((f) => f.label), physicalCols: cols.length,
  masked: [...MASKED_COLS], nonEmpty, failed: failed.map((f) => f.what),
}, null, 2), 'utf8')

await pool.close()
if (failed.length) process.exit(1)
