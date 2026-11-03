// 判定:服务器登记的 hash 与本地脚本 hash 不同,是「仅行尾/BOM 差异」还是「内容真的变了」
// 用法: node _hash-variants.mjs <serverLog.txt>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const TOOLS = 'D:/workspace/yinjia/deploy/pkg-incr-20261103/tools'
const manifest = fs.readFileSync(path.join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

const logged = new Map()
for (const line of fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('-') || t.startsWith('script_name') || t.startsWith('[')) continue
  const [name, hash] = t.split('|').map((s) => s.trim())
  if (name && /^[0-9a-f]{64}$/i.test(hash)) logged.set(name, hash.toLowerCase())
}

const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const cosmetic = [], real = []
for (const s of manifest) {
  const p = path.join(TOOLS, s)
  const lh = logged.get(s)
  if (!lh || !fs.existsSync(p)) continue
  const buf = fs.readFileSync(p)
  if (sha(buf) === lh) continue
  const variants = new Map()
  const add = (tag, b) => variants.set(sha(b), tag)
  add('raw', buf)
  // 去 BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) add('无BOM', buf.subarray(3))
  else add('加BOM', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), buf]))
  const txt = buf.toString('utf8')
  const crlf = txt.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n')
  const lf = txt.replace(/\r\n/g, '\n')
  add('全CRLF', Buffer.from(crlf, 'utf8'))
  add('全LF', Buffer.from(lf, 'utf8'))
  add('CRLF+无BOM', Buffer.from(crlf, 'utf8').subarray(0))
  const hit = variants.get(lh)
  if (hit) cosmetic.push([s, hit])
  else real.push(s)
}
console.log(`仅行尾/BOM 差异(可 baseline 刷新): ${cosmetic.length}`)
cosmetic.forEach(([s, tag]) => console.log(`  ${s}   <${tag}>`))
console.log(`\n内容确实不同: ${real.length}`)
real.forEach((s) => console.log('  ' + s))
