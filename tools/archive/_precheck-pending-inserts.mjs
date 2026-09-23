// 离线预检:对"会在正式库执行/重跑"的脚本,检查每条 INSERT 的列在当前 schema 里是否存在
//
// 用途:对清单里"会执行/会重跑"的全部脚本做 INSERT 列名预检,回答"修好一处之后还会不会连环炸"。
// 用法:node tools/archive/_precheck-pending-inserts.mjs <schema.tsv> <schema-log.txt>
//   schema.tsv 见 _precheck-insert-columns.mjs 头部;
//   schema-log.txt 由 sqlcmd 导出:
//     sqlcmd -S localhost -E -I -d HSDZ_MES -h -1 -W -s "|" -o prod-schema-log.txt -Q "SET NOCOUNT ON; SELECT script_name, content_hash FROM yj_schema_log;"
// 目的:回答"修好 _doc_part3_data.sql 之后还会不会连环炸"
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const TOOLS = 'C:\\INCER\\YINJIA-MES\\tools'
const schemaFile = process.argv[2]
const logFile = process.argv[3]

// 1) schema: table/view -> Set<column>
const cols = new Map()
for (const line of fs.readFileSync(schemaFile, 'utf8').split('\n')) {
  const p = line.trim().split('\t')
  if (p.length !== 3) continue
  const [, obj, col] = p
  if (!obj || !col) continue
  if (!cols.has(obj)) cols.set(obj, new Set())
  cols.get(obj).add(col)
}

// 2) 正式库已登记的哈希
const logged = new Map()
for (const line of fs.readFileSync(logFile, 'utf8').split('\n')) {
  const t = line.trim()
  const i = t.lastIndexOf('|')
  if (i < 0) continue
  const n = t.slice(0, i).trim(), h = t.slice(i + 1).trim()
  if (n && /^[0-9a-f]{64}$/i.test(h)) logged.set(n, h.toLowerCase())
}

// 3) 清单里"会执行/会重跑"的脚本
const manifest = fs.readFileSync(path.join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
const willRun = []
manifest.forEach((s, idx) => {
  const p = path.join(TOOLS, s)
  if (!fs.existsSync(p)) return
  const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  if (logged.get(s) !== h) willRun.push([idx + 1, s, p])
})

// 4) 检查
let badScripts = 0, badInserts = 0, unknownTable = 0
const report = []
for (const [idx, name, p] of willRun) {
  const sql = fs.readFileSync(p, 'utf8')
  const problems = []
  for (const m of sql.matchAll(/INSERT\s+INTO\s+([\w\u4e00-\u9fa5]+)\s*\(([^)]*)\)/gi)) {
    const tbl = m[1]
    const tableCols = cols.get(tbl)
    if (!tableCols) { unknownTable++; continue }
    const want = m[2].split(',').map((s) => s.trim().replace(/^\[|\]$/g, '')).filter(Boolean)
    const miss = want.filter((c) => !tableCols.has(c) && !/^(id|sql|@)/i.test(c))
    if (miss.length) problems.push(`${tbl}: 缺 ${miss.join(', ')}`)
  }
  if (problems.length) {
    badScripts++; badInserts += problems.length
    report.push({ idx, name, problems })
  }
}

console.log(`会执行/会重跑的脚本: ${willRun.length} 条`)
console.log(`其中 INSERT 列名对不上当前 schema 的: ${badScripts} 条(共 ${badInserts} 处)`)
console.log(`INSERT 目标不在 schema 里(可能是临时表/变量表,已忽略): ${unknownTable} 处`)
console.log('')
for (const r of report) {
  console.log(`#${String(r.idx).padStart(3)} ${r.name}`)
  r.problems.slice(0, 6).forEach((x) => console.log(`        ${x}`))
  if (r.problems.length > 6) console.log(`        … 还有 ${r.problems.length - 6} 处`)
}
