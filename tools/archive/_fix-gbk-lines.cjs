// _fix-gbk-lines.cjs — 把 db-migrations.txt 里 2 行 GBK 注释转为 UTF-8(仓库约定 UTF-8,DbSync 严格 UTF-8 读取)
const fs = require('fs')
const f = 'tools/db-migrations.txt'
const buf = fs.readFileSync(f)
const gbk = new TextDecoder('gbk')
const strict = new TextDecoder('utf-8', { fatal: true })

const lines = []
let start = 0
for (let i = 0; i < buf.length; i++) {
  if (buf[i] === 0x0a) { lines.push(buf.slice(start, i + 1)); start = i + 1 }
}
lines.push(buf.slice(start))

let fixed = 0
const out = lines.map((l) => {
  try { strict.decode(l); return l } catch (e) {
    const s = l.toString('latin1') // 每行先转 latin1 字符串(字节一一对应)
    const hadNl = s.endsWith('\n')
    const body = Buffer.from(s.replace(/\r?\n$/, ''), 'latin1')
    const text = gbk.decode(body) // GBK → 正确中文
    fixed++
    console.log('修复:', JSON.stringify(text.slice(0, 60)))
    return Buffer.from(text + (hadNl ? '\r\n' : ''), 'utf8')
  }
})

fs.writeFileSync(f, Buffer.concat(out))
// 终验:全文件严格 UTF-8
const check = fs.readFileSync(f)
try { strict.decode(check); console.log('修复', fixed, '行,全文件已严格 UTF-8 ✓') } catch (e) { console.log('仍有非UTF-8!'); process.exit(1) }
