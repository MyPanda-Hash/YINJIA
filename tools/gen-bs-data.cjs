// gen-bs-data.cjs — form_data(JSON) → bs_* 表 INSERT 语句
const fs = require('fs')
const path = require('path')
const panels = JSON.parse(fs.readFileSync(path.join(__dirname, '_bs_panels.json'), 'utf8'))
const lines = fs.readFileSync(path.join(__dirname, 'base-panels-data.tsv'), 'utf8')
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
const q = (s) => "N'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
const out = ['-- 基础设置数据迁移(light-mes form_data → bs_*)', 'USE HSDZ_MES;', 'SET NOCOUNT ON;', '']
let total = 0
for (const line of lines) {
  const [code, formNo, dataRaw, detailRaw] = line.split('\t')
  const row = { panel_code: code, form_no: formNo || '', data: dataRaw || '{}', detail_data: detailRaw || '{}' }
  const m = panels.find((p) => p.code === row.panel_code)
  if (!m) continue
  let data = {}
  try { data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {}) } catch { data = {} }
  let detail = {}
  try { detail = typeof row.detail_data === 'string' ? JSON.parse(row.detail_data) : (row.detail_data || {}) } catch { detail = {} }
  // 档案行来源:tab 型 → detail_data[tabKey] 数组;schema 型 → [data] 单行
  const recs = m.useTab ? (Array.isArray(detail[m.tabKey]) ? detail[m.tabKey] : []) : [data]
  for (const rec of recs) {
    const cols = [], vals = []
    for (const f of m.fields) {
      if (rec[f.name] === undefined || rec[f.name] === null) continue
      cols.push(`[${f.name}]`)
      const v = rec[f.name]
      if (f.type === '小数' || f.type === '整数') vals.push(String(Number(v)))
      else if (f.type === '是否') vals.push(v ? '1' : '0')
      else if (f.type === '日期') vals.push(q(String(v).slice(0, 10)))
      else vals.push(q(v))
    }
    if (rec['备注'] !== undefined) { cols.push('[备注]'); vals.push(q(rec['备注'])) }
    cols.push('[asp_user1]', '[asp_time1]'); vals.push("N'migration'", 'SYSDATETIME()')
    if (!cols.length || cols.length <= 2) continue
    out.push(`INSERT INTO ${m.table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`)
    total++
  }
}
fs.writeFileSync(path.join(__dirname, '_bs_part3_data.sql'), out.join('\n') + '\n', 'utf8')
console.log(`数据 INSERT 生成:${total} 行`)
