// _find-bad-utf8.cjs — 定位 db-migrations.txt 里的非 UTF-8 行
const fs = require('fs')
const buf = fs.readFileSync('tools/db-migrations.txt')
const dec = new TextDecoder('utf-8', { fatal: true })
const lines = []
let start = 0
for (let i = 0; i < buf.length; i++) {
  if (buf[i] === 0x0a) { lines.push(buf.slice(start, i + 1)); start = i + 1 }
}
lines.push(buf.slice(start))
let bad = 0
lines.forEach((l, idx) => {
  try { dec.decode(l) } catch (e) {
    bad++
    if (bad <= 5) console.log('行', idx + 1, '| latin1预览:', JSON.stringify(l.toString('latin1').replace(/\r?\n$/, '').slice(0, 80)))
  }
})
console.log('共', bad, '行非法UTF-8 / 总行数', lines.length)
