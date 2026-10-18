/**
 * _q-sheet-key-audit.mjs — 全量扫查**文书面板配置的数据键**是否等于该面板的字段 label
 *
 * 背景(2026-10-16 用户报障「产品信息表的主要性能描述和审批人保存都不见了」):
 *   接口行契约的键是 **yj_field.label**(QueryService.rowToLabels),而 recordSheetConfigs 里
 *   有些格子的 `key` 填的是**物理列名**(特殊性能描述 / 审核人一级 / 责任人 …):
 *     · 读:head['特殊性能描述'] 取不到(label 才是键)⇒ 界面永远空白;
 *     · 写:后端不认识列名 ⇒ **静默丢弃**,库里恒 NULL。
 * 本脚本把 recordSheetConfigs.js 里**每个面板块**的 key 抽出来,与该面板 yj_field 的 label 对账,
 * 把「对不上的 panel + 字段」全部列出来,并给出建议改成的 label(按 col_name 反查)。
 *
 * 用法: cd tools 之前或之后均可: node tools/archive/_sheetkeys-20261016/_q-sheet-key-audit.mjs [--db HSDZ_MES]
 */
import mssql from '../../../deploy/node_modules/mssql/index.js'
import { readFileSync } from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 ? process.argv[i + 1] : d }
const DB = arg('db', 'HSDZ_MES')
const SRC = 'frontend/src/core/views/recordSheetConfigs.js'
const src = readFileSync(SRC, 'utf8')

/* ── 1. 切出每个面板块(顶层 `CODE: {` 到下一个同级键) ── */
const lines = src.split(/\r?\n/)
const heads = []
lines.forEach((ln, i) => { const m = /^ {2}([A-Z][A-Z0-9_]+):\s*\{/.exec(ln); if (m) heads.push({ code: m[1], line: i }) })
const blocks = heads.map((h, k) => ({ code: h.code, line: h.line + 1, text: lines.slice(h.line, k + 1 < heads.length ? heads[k + 1].line : lines.length).join('\n') }))

/* ── 2. 抽该块里的数据键(key:'X';排除 css/class 之类的伪 key) ── */
const keysOf = (text) => {
  const out = new Map()   // key -> 出现次数
  for (const m of text.matchAll(/(?:^|[\s,{(])key:\s*'([^']+)'/g)) {
    const k = m[1]
    // 过滤明显不是字段的(样式/图标/类型名在配置里既有 key 也有 class 语义;这里按"看起来像中文或字段名")
    out.set(k, (out.get(k) || 0) + 1)
  }
  for (const m of text.matchAll(/(?:titleKey|docNoKey|coverDocNoKey):\s*'([^']+)'/g)) out.set(m[1], (out.get(m[1]) || 0) + 1)
  return out
}

/* ── 3. 取每个面板的 (label 集, col_name→label 映射) ── */
const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026', options: { encrypt: false, trustServerCertificate: true },
})
const rows = (await pool.request().query('SELECT panel_code, ISNULL(label,N\'\') AS label, ISNULL(col_name,N\'\') AS col_name FROM yj_field')).recordset
await pool.close()
const byPanel = new Map()
for (const r of rows) {
  if (!byPanel.has(r.panel_code)) byPanel.set(r.panel_code, { labels: new Set(), col2label: new Map() })
  const p = byPanel.get(r.panel_code)
  if (r.label) p.labels.add(r.label)
  if (r.col_name && r.label && !p.col2label.has(r.col_name)) p.col2label.set(r.col_name, r.label)
}

/* ── 4. 对账 ── */
let totalBad = 0, totalKeys = 0, panelsWithBad = 0
const report = []
for (const b of blocks) {
  const meta = byPanel.get(b.code)
  if (!meta) { report.push({ code: b.code, note: '（该面板在 yj_field 里没有字段 —— 跳过或未注册）', bad: [] }); continue }
  const keys = keysOf(b.text)
  totalKeys += keys.size
  const bad = []
  for (const k of keys.keys()) {
    if (meta.labels.has(k)) continue
    const guess = meta.col2label.get(k)
    bad.push({ key: k, label: guess || '' })
  }
  if (bad.length) { totalBad += bad.length; panelsWithBad++ }
  report.push({ code: b.code, line: b.line, keys: keys.size, bad })
}

console.log(`== 纸面数据键对账 @${DB}(源:${SRC})==`)
console.log(`文书面板块 ${blocks.length} 个;抽取数据键 ${totalKeys} 个;对不上字段 label 的 ${totalBad} 个(分布在 ${panelsWithBad} 个面板)\n`)
for (const r of report) {
  if (!r.bad.length) continue
  console.log(`● ${r.code}(配置第 ${r.line} 行)` + (r.note ? ` ${r.note}` : ''))
  for (const b of r.bad) {
    console.log(`    key '${b.key}'` + (b.label ? `  → 应改为 label '${b.label}'(同面板物理列名同名)` : `  → 该面板**没有**这个字段(label 里查不到)⇒ 这一格存不进库`))
  }
}
const clean = report.filter((r) => !r.bad.length && !r.note).map((r) => r.code)
console.log(`\n干净的文书面板(${clean.length} 个): ${clean.join(', ')}`)
