// gen-so-data.cjs — SO_ORDER form_data → bd/bl INSERT
const fs = require('fs')
const path = require('path')
const m = JSON.parse(fs.readFileSync(path.join(__dirname, '_so_meta.json'), 'utf8'))
const lines = fs.readFileSync(path.join(__dirname, 'so-panels-data.tsv'), 'utf8')
  .replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
const q = (s) => "N'" + String(s == null ? '' : s).replace(/'/g, "''") + "'"
const conv = (v, t) => {
  if (t === '小数' || t === '整数') return String(Number(v) || 0)
  if (t === '是否') return v ? '1' : '0'
  if (t === '日期') return q(String(v).slice(0, 10))
  return q(v)
}
let out = ['USE HSDZ_MES;', 'SET NOCOUNT ON;', ''], n = 0
for (const line of lines) {
  const [code, no, dR, lR, st] = line.split('\t')
  let data = {}, detail = {}
  try { data = JSON.parse(dR || '{}') } catch { data = {} }
  try { detail = JSON.parse(lR || '{}') } catch { detail = {} }
  const status = ({ '已审核': '已审核', '审批中': '审批中', '草稿': '草稿' })[st] || '草稿'
  const noV = data[m.noCol] || no || ''
  const hc = [], hv = []
  for (const f of m.hFields) {
    if (data[f.name] !== undefined && data[f.name] !== null) { hc.push(`[${f.name}]`); hv.push(conv(data[f.name], f.type)) }
  }
  if (data['备注'] !== undefined && !m.hFields.some((f) => f.name === '备注')) { hc.push('[备注]'); hv.push(q(data['备注'])) }
  hc.push('[单据状态]', '[asp_user1]'); hv.push(q(status), "N'migration'")
  out.push(`INSERT INTO ${m.headT} (${hc.join(',')}) VALUES (${hv.join(',')});`); n++
  const recs = Array.isArray(detail[m.tabKey]) ? detail[m.tabKey] : []
  for (const r of recs) {
    const lc = [`[${m.noCol}]`], lv = [q(noV)]
    for (const f of m.lFields) {
      if (f.name === m.noCol) continue
      if (r[f.name] !== undefined && r[f.name] !== null) { lc.push(`[${f.name}]`); lv.push(conv(r[f.name], f.type)) }
    }
    lc.push('[asp_user1]'); lv.push("N'migration'")
    out.push(`INSERT INTO ${m.lineT} (${lc.join(',')}) VALUES (${lv.join(',')});`); n++
  }
}
fs.writeFileSync(path.join(__dirname, '_so_data.sql'), out.join('\n') + '\n', 'utf8')
console.log(`数据 INSERT: ${n} 行`)
