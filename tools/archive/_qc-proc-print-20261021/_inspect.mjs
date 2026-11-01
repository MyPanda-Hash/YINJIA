import fs from 'node:fs'
const p = 'tools/archive/_qc-proc-print-20261021/jrxml-now.pdf'
const b = fs.readFileSync(p)
const s = b.toString('latin1')
console.log('bytes:', b.length)
console.log('pages:', (s.match(/\/Type\s*\/Page[^s]/g) || []).length)
const mb = s.match(/MediaBox\s*\[[^\]]*\]/g) || []
console.log('MediaBox:', mb.slice(0, 2))
// PDF 里中文是子集字体的编码,不能直接搜中文;看几个结构关键字
for (const k of ['/Font', '/Image', 'FlateDecode']) {
  console.log(k, (s.match(new RegExp(k.replace('/', '\\/'), 'g')) || []).length)
}
