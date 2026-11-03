// 比对:tools/db-migrations.txt 清单 vs 两账套 yj_schema_log 登记
// 用法: node _cmp.mjs <serverLog.txt> <localLog.txt>
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const TOOLS = 'D:/workspace/yinjia/deploy/pkg-incr-20261103/tools'
const manifest = fs.readFileSync(path.join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

function parseLog(p) {
  const m = new Map()
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('-') || t.startsWith('script_name') || t.startsWith('[')) continue
    const parts = t.split('|').map((s) => s.trim())
    if (parts.length < 2) continue
    const [name, hash] = parts
    if (name && /^[0-9a-f]{64}$/i.test(hash)) m.set(name, hash.toLowerCase())
  }
  return m
}

const srv = parseLog(process.argv[2])
const loc = parseLog(process.argv[3])
console.log(`清单条数=${manifest.length}  服务器登记=${srv.size}  本地登记=${loc.size}`)

const missing = [], changed = [], fileMissing = []
manifest.forEach((s, i) => {
  const p = path.join(TOOLS, s)
  const sh = srv.get(s)
  if (!fs.existsSync(p)) { fileMissing.push([i + 1, s]); return }
  const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  if (!sh) missing.push([i + 1, s, loc.has(s) ? '本地已登记' : '本地也未登记'])
  else if (sh !== h) changed.push([i + 1, s, sh.slice(0, 12), h.slice(0, 12)])
})

console.log(`\n===== A. 服务器缺失(会当新增执行) : ${missing.length} =====`)
missing.forEach((r) => console.log(`  #${r[0]}  ${r[1]}   [${r[2]}]`))
console.log(`\n===== B. 服务器哈希不符(会重跑) : ${changed.length} =====`)
changed.forEach((r) => console.log(`  #${r[0]}  ${r[1]}   服务器=${r[2]} 清单=${r[3]}`))
console.log(`\n===== C. 清单里有但文件不存在 : ${fileMissing.length} =====`)
fileMissing.forEach((r) => console.log(`  #${r[0]}  ${r[1]}`))

// 服务器登记但清单没有(历史遗留/已移除)
const extra = [...srv.keys()].filter((k) => !manifest.includes(k))
console.log(`\n===== D. 服务器有登记但清单已移除 : ${extra.length} =====`)
extra.forEach((k) => console.log('  ' + k))
