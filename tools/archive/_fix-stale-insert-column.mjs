// 精确删除 bl_dispatch INSERT 里的 [产品名称] 及其对应值(按位对应,不做朴素字符串替换)
//
// 用途:按位删除某表 INSERT 里一个**已失效列**(连同它对应的值),列名可含括号、值可含逗号/引号。
//   用于 2026-09-22 修 _doc_part3_data.sql 的 bl_dispatch.[产品名称](共 5 条语句)。
// 用法:node tools/archive/_fix-stale-insert-column.mjs <脚本.sql> [表名] [列名]
import fs from 'node:fs'

const file = process.argv[2] || 'C:\\INCER\\YINJIA-MES\\tools\\_doc_part3_data.sql'
const wantTable = process.argv[3] || 'bl_dispatch'
const wantCol = process.argv[4] || '产品名称'

function matchParen(s, i) {
  let depth = 0, inStr = false
  for (let k = i; k < s.length; k++) {
    const c = s[k]
    if (inStr) { if (c === "'") { if (s[k + 1] === "'") { k++; continue } inStr = false } continue }
    if (c === "'") { inStr = true; continue }
    if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0) return k }
  }
  return -1
}
function splitTop(s) {
  const out = []; let depth = 0, inStr = false, cur = ''
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (inStr) { cur += c; if (c === "'") { if (s[k + 1] === "'") { cur += s[k + 1]; k++; continue } inStr = false } continue }
    if (c === "'") { inStr = true; cur += c; continue }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur)
  return out
}

const raw = fs.readFileSync(file, 'utf8')
const hadEol = raw.includes('\r\n') ? '\r\n' : '\n'
const lines = raw.split(/\r?\n/)
let changed = 0

const out = lines.map((line, idx) => {
  const m = new RegExp(`^\\s*INSERT\\s+INTO\\s+${wantTable}\\s*\\(`, 'i').exec(line)
  if (!m) return line
  const open = m[1].length - 1
  const close = matchParen(line, open)
  if (close < 0) throw new Error(`L${idx + 1}: 列清单括号不配对`)
  const cols = splitTop(line.slice(open + 1, close))
  const colsTrim = cols.map((c) => c.trim().replace(/^\[|\]$/g, ''))
  const target = colsTrim.indexOf(wantCol)
  if (target < 0) return line

  const vIdx = line.indexOf('VALUES', close)
  if (vIdx < 0) throw new Error(`L${idx + 1}: 未找到 VALUES`)
  const vOpen = line.indexOf('(', vIdx)
  const vClose = matchParen(line, vOpen)
  if (vClose < 0) throw new Error(`L${idx + 1}: 值清单括号不配对`)
  const vals = splitTop(line.slice(vOpen + 1, vClose))
  if (vals.length !== cols.length) throw new Error(`L${idx + 1}: 列 ${cols.length} ≠ 值 ${vals.length}`)

  const newCols = cols.filter((_, i) => i !== target)
  const newVals = vals.filter((_, i) => i !== target)
  changed++
  console.log(`L${idx + 1}: 删除列「${colsTrim[target]}」(第 ${target + 1} 列) 及其值 ${vals[target].trim()}`)
  return line.slice(0, open + 1) + newCols.join(',') + ')' +
    line.slice(close + 1, vOpen + 1) + newVals.join(',') + ')' + line.slice(vClose + 1)
})

if (!changed) { console.log('未找到需要修改的行'); process.exit(1) }
fs.writeFileSync(file, out.join(hadEol), 'utf8')
console.log(`\n共修改 ${changed} 条语句,已写回 ${file}`)
