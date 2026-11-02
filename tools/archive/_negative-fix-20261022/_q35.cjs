/** 校验脚本里所有 INSERT 的列数/值数(含动态拼接的表名) */
const fs = require('node:fs')
const src = fs.readFileSync('D:/YINJIA-main/tools/balance-negative-stock.js', 'utf8')

function readParen(s, from) {
  let depth = 1, i = from, inStr = false, out = ''
  for (; i < s.length; i++) {
    const ch = s[i]
    if (ch === "'") { inStr = !inStr; out += ch; continue }
    if (!inStr && ch === '(') depth++
    if (!inStr && ch === ')') { depth--; if (depth === 0) break }
    out += ch
  }
  return { body: out, end: i + 1 }
}
function splitTop(s) {
  const parts = []; let depth = 0, cur = '', inStr = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === "'") { inStr = !inStr; cur += ch; continue }
    if (!inStr && ch === '(') depth++
    if (!inStr && ch === ')') depth--
    if (!inStr && ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

// 匹配: INSERT INTO xxx (  或  INSERT INTO ${...} (
const re = /INSERT\s+INTO\s+(?:\$\{[^}]+\}|[\w\.]+)\s*\(/gi
let m, n = 0, bad = 0
while ((m = re.exec(src))) {
  const colBlock = readParen(src, re.lastIndex)
  const cols = splitTop(colBlock.body)
  const rest = src.slice(colBlock.end)
  const vm = /^\s*VALUES\s*\(/i.exec(rest)
  if (!vm) { console.log('  (跳过,无 VALUES): ' + src.slice(m.index, m.index + 60).replace(/\s+/g, ' ')); continue }
  const valBlock = readParen(rest, vm[0].length)
  const vals = splitTop(valBlock.body)
  n++
  const line = src.slice(0, m.index).split('\n').length
  if (cols.length !== vals.length) {
    bad++
    console.log(`✗ 第${line}行 列${cols.length}/值${vals.length}`)
    console.log('   列: ' + cols.join(','))
    console.log('   值: ' + vals.join(' | '))
  } else console.log(`✓ 第${line}行 ${cols.length} 列`)
}
console.log(`\n共 ${n} 条,不匹配 ${bad} 条`)
