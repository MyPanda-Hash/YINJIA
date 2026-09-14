// gen-doc-data.cjs — 单据 form_data → bd_*(头)+ bl_*(行)
const fs = require('fs')
const path = require('path')
const panels = JSON.parse(fs.readFileSync(path.join(__dirname, '_doc_panels.json'), 'utf8')).filter((p) => p.kind === 'doc')
const lines = fs.readFileSync(path.join(__dirname, 'doc-panels-data.tsv'), 'utf8')
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
const q = (s) => "N'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
const out = ['-- 单据数据迁移', 'USE HSDZ_MES;', 'SET NOCOUNT ON;', '']
let n = 0
for (const line of lines) {
  const parts = line.split('\t')
  const [code, formNo, dataRaw, detailRaw, status] = parts
  const m = panels.find((p) => p.code === code)
  if (!m) continue
  let data = {}, detail = {}
  try { data = JSON.parse(dataRaw || '{}') } catch { data = {} }
  try { detail = JSON.parse(detailRaw || '{}') } catch { detail = {} }
  const statusMap = { '已审核': '已审核', '审批中': '审批中', '草稿': '草稿', '已中止': '已作废' }
  const st = statusMap[status] || '草稿'
  const no = data[m.noCol] || formNo || ''
  // 头
  const hCols = [], hVals = []
  for (const f of m.hFields) {
    if (data[f.name] === undefined || data[f.name] === null) continue
    hCols.push(`[${f.name}]`)
    hVals.push(conv(data[f.name], f.type))
  }
  if (data['备注'] !== undefined && !m.hFields.some((f) => f.name === '备注')) { hCols.push('[备注]'); hVals.push(q(data['备注'])) }
  hCols.push('[单据状态]'); hVals.push(q(st))
  hCols.push('[asp_user1]', '[asp_time1]'); hVals.push("N'migration'", 'SYSDATETIME()')
  out.push(`INSERT INTO ${m.headT} (${hCols.join(', ')}) VALUES (${hVals.join(', ')});`)
  n++
  // 行
  const recs = Array.isArray(detail[m.tabKey]) ? detail[m.tabKey] : []
  for (const rec of recs) {
    const lCols = [`[${m.noCol}]`], lVals = [q(no)]
    for (const f of m.lFields) {
      if (f.name === m.noCol) continue
      if (rec[f.name] === undefined || rec[f.name] === null) continue
      lCols.push(`[${f.name}]`)
      lVals.push(conv(rec[f.name], f.type))
    }
    lCols.push('[asp_user1]'); lVals.push("N'migration'")
    out.push(`INSERT INTO ${m.lineT} (${lCols.join(', ')}) VALUES (${lVals.join(', ')});`)
    n++
  }
}
function conv(v, type) {
  if (type === '小数' || type === '整数') return String(Number(v) || 0)
  if (type === '是否') return v ? '1' : '0'
  if (type === '日期') return q(String(v).slice(0, 10))
  return q(v)
}
fs.writeFileSync(path.join(__dirname, '_doc_part3_data.sql'), out.join('\n') + '\n', 'utf8')
console.log(`数据 INSERT:${n} 行`)
