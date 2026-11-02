/** 校验每条 INSERT 的列数与值数是否相等(防止再次出现列值错位) */
const fs = require('node:fs')
const src = fs.readFileSync('D:/YINJIA-main/tools/balance-negative-stock.js', 'utf8')

// 抓 INSERT INTO x (cols) VALUES (vals) 以及 column=, value=
const re = /INSERT\s+INTO\s+([\w\.]+)\s*\(([^)]*)\)\s*VALUES\s*\(/gis
let m, n = 0, bad = 0
while ((m = re.exec(src))) {
  const table = m[1]
  const cols = m[2].split(',').map((s) => s.trim()).filter(Boolean)
  // 从 VALUES( 之后开始,按括号深度找到配对的右括号
  const from = re.lastIndex
  let depth = 1, i = from, inStr = false, v = ''
  for (; i < src.length; i++) {
    const ch = src[i]
    if (ch === "'") { inStr = !inStr; v += ch; continue }
    if (!inStr && ch === '(') depth++
    if (!inStr && ch === ')') { depth--; if (depth === 0) break }
    v += ch
  }
  const vals = []
  let depth = 0, cur = '', inStr = false
  for (let i = 0; i < v.length; i++) {
    const ch = v[i]
    if (ch === "'" && v[i - 1] !== '\\') { inStr = !inStr; cur += ch; continue }
    if (!inStr && ch === '(') depth++
    if (!inStr && ch === ')') depth--
    if (!inStr && ch === ',' && depth === 0) { vals.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) vals.push(cur.trim())
  n++
  const okc = cols.length === vals.length
  if (!okc) { bad++; console.log(`✗ ${table}: 列 ${cols.length} / 值 ${vals.length}`); console.log('   列: ' + cols.join(',')); console.log('   值: ' + vals.join(' | ')) }
  else console.log(`✓ ${table}: ${cols.length} 列`)
}
console.log(`\n共 ${n} 条 INSERT,不匹配 ${bad} 条`)
