// 比对:清单 226 条脚本的"当前文件哈希" vs "正式库 yj_schema_log 登记的哈希"
//
// 用途:比对「清单 226 条脚本的当前文件哈希」与「某账套 yj_schema_log 登记的哈希」,
//   算出下一次 DbSync 会重跑/新增哪些 —— 用来判断"这个库的迁移链还会不会炸、炸在哪一条"。
// 用法:node tools/archive/_cmp-migration-hashes.mjs <schema-log.txt>
//   schema-log.txt 导出方式见 _precheck-pending-inserts.mjs 头部。
// 判定下一次 DbSync 会重跑哪些(以及第一颗地雷在哪)
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const TOOLS = 'C:\\INCER\\YINJIA-MES\\tools'
const manifest = fs.readFileSync(path.join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))

const logText = fs.readFileSync(process.argv[2], 'utf8')
const logged = new Map()
for (const line of logText.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('-') || t.startsWith('script_name')) continue
  const i = t.lastIndexOf('|')
  if (i < 0) continue
  const name = t.slice(0, i).trim()
  const hash = t.slice(i + 1).trim()
  if (name && /^[0-9a-f]{64}$/i.test(hash)) logged.set(name, hash.toLowerCase())
}

let match = 0, diff = 0, notLogged = 0, missing = 0
const diffs = []
manifest.forEach((s, idx) => {
  const p = path.join(TOOLS, s)
  if (!fs.existsSync(p)) { missing++; diffs.push([idx + 1, s, '文件缺失']); return }
  const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  const lh = logged.get(s)
  if (!lh) { notLogged++; diffs.push([idx + 1, s, '未登记(会当新增执行)']) }
  else if (lh === h) match++
  else { diff++; diffs.push([idx + 1, s, '内容已变(会重跑)']) }
})

console.log(`清单条数        : ${manifest.length}`)
console.log(`正式库登记条数  : ${logged.size}`)
console.log(`哈希一致(跳过) : ${match}`)
console.log(`哈希不同(重跑) : ${diff}`)
console.log(`未登记(新增)   : ${notLogged}`)
console.log(`文件缺失        : ${missing}`)
console.log(`\n会执行/会重跑的前 30 条(按清单顺序):`)
diffs.slice(0, 30).forEach(([i, s, why]) => console.log(`  #${String(i).padStart(3)} ${s}  —— ${why}`))
if (diffs.length > 30) console.log(`  … 其余 ${diffs.length - 30} 条`)

// 47 条"未登记"的完整清单 —— 决定 baseline 能不能用
const unlogged = diffs.filter((d) => d[2].startsWith('未登记'))
console.log(`\n=== 未登记(会在正式库当"新增"执行)的 ${unlogged.length} 条 ===`)
unlogged.forEach(([i, s]) => console.log(`  #${String(i).padStart(3)} ${s}`))

