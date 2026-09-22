// 用途:判断"能不能对某个账套做 DbSync baseline(只登记不执行)" ——
//   把清单里"会执行/会重跑"的脚本逐条抽出声明的对象(表/列/视图/面板/字段),
//   与目标库现状比对,列出【声明了但库里没有】的项。全部命中 ⇒ baseline 安全;
//   有真缺失 ⇒ 先 `DbSync run <那条脚本>` 补上,再 baseline。
//
// 用法:node tools/archive/_verify-migration-claims.mjs <ledger-check 目录>
//   该目录需先备好 4 份快照(全部由 sqlcmd 从**目标库**导出,目录示例 %TEMP%\ledger-check):
//     schema.tsv  表/视图 → 列:  sqlcmd -S localhost -E -I -d HSDZ_MES -f 65001 -h -1 -W -s "\t" -o schema.tsv -Q "SET NOCOUNT ON; SELECT o.type, o.name, c.name FROM sys.columns c JOIN sys.objects o ON o.object_id=c.object_id WHERE o.type IN ('U','V');"
//     panels.txt  面板码:        ... -Q "SET NOCOUNT ON; SELECT panel_code FROM yj_panel;"
//     fields.tsv  面板+列名+标签: ... -s "\t" -Q "SET NOCOUNT ON; SELECT panel_code, col_name, label FROM yj_field;"
//     log.txt     迁移登记:      ... -s "|"  -Q "SET NOCOUNT ON; SELECT script_name, content_hash FROM yj_schema_log;"
//
// ⚠ 阅读结果时注意噪声(2026-09-22 实测):游标/变量的动态 INSERT(`VALUES (@p, @n, …)`)
//   会被抽成 `@n`,`IF COL_LENGTH('T',旧列名) IS NOT NULL` 这类**改名/删除守卫**会被误判成"缺失"
//   (旧列名当然不存在 —— 那恰恰说明脚本已执行过)。真正的缺口长这样:
//   对象名精确、且脚本里有与之对应的 `IF NOT EXISTS ... INSERT`(例:RD_SHARE_FILE 面板行)。
// 来源:2026-09-22 迁移链收口时的一次性核对器,按仓库约定归档保档。
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const TOOLS = 'C:\\INCER\\YINJIA-MES\\tools'
const D = process.argv[2] || 'C:\\Users\\x1787\\AppData\\Local\\Temp\\ledger-check'

const norm = (s) => s.replace(/^\[|\]$/g, '').replace(/^dbo\./i, '').trim()

const colsByObj = new Map()
for (const line of fs.readFileSync(path.join(D, 'schema.tsv'), 'utf8').split('\n')) {
  const p = line.trim().split('\t')
  if (p.length !== 3) continue
  const [, obj, col] = p
  if (!obj || !col) continue
  if (!colsByObj.has(obj)) colsByObj.set(obj, new Set())
  colsByObj.get(obj).add(col)
}
const panels = new Set(fs.readFileSync(path.join(D, 'panels.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean))
const fields = new Set()
for (const line of fs.readFileSync(path.join(D, 'fields.tsv'), 'utf8').split('\n')) {
  const p = line.trim().split('\t')
  if (p.length !== 3) continue
  fields.add(p[0] + '\u0000' + p[1])
  fields.add(p[0] + '\u0000' + p[2])
}
const logged = new Map()
for (const line of fs.readFileSync(path.join(D, 'log.txt'), 'utf8').split('\n')) {
  const t = line.trim(); const i = t.lastIndexOf('|')
  if (i < 0) continue
  const n = t.slice(0, i).trim(), h = t.slice(i + 1).trim()
  if (n && /^[0-9a-f]{64}$/i.test(h)) logged.set(n, h.toLowerCase())
}

const manifest = fs.readFileSync(path.join(TOOLS, 'db-migrations.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
const pending = []
manifest.forEach((s, idx) => {
  const p = path.join(TOOLS, s)
  if (!fs.existsSync(p)) return
  const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
  if (logged.get(s) !== h) pending.push({ idx: idx + 1, name: s, file: p, why: logged.has(s) ? 'changed' : 'unlogged' })
})

const RE = {
  objId: /OBJECT_ID\(\s*N?'([^']+)'/gi,
  createTable: /CREATE\s+TABLE\s+(\[[^\]]+\]|[A-Za-z0-9_\u4e00-\u9fa5]+)/gi,
  createView: /CREATE\s+(?:OR\s+ALTER\s+)?VIEW\s+(\[[^\]]+\]|[A-Za-z0-9_\u4e00-\u9fa5]+)/gi,
  colLength: /COL_LENGTH\(\s*N?'([^']+)'\s*,\s*N?'([^']+)'\s*\)/gi,
  alterAdd: /ALTER\s+TABLE\s+(\[[^\]]+\]|[A-Za-z0-9_\u4e00-\u9fa5]+)\s+ADD\s+\[([^\]]+)\]/gi,
  yjPanel: /INSERT\s+INTO\s+yj_panel[\s\S]{0,200}?VALUES\s*\(\s*N?'([^']+)'/gi,
  yjField: /INSERT\s+INTO\s+yj_field[\s\S]{0,400}?VALUES\s*\(([^)]{0,200})/gi,
}

function claimsOf(file) {
  const sql = fs.readFileSync(file, 'utf8')
  const miss = [], ok = []
  const checkTable = (n) => { const t = norm(n); (colsByObj.has(t) ? ok : miss).push('表 ' + t) }
  const checkView = (n) => { const t = norm(n); (colsByObj.has(t) ? ok : miss).push('视图 ' + t) }
  const checkCol = (t, c) => { const T = norm(t); const s = colsByObj.get(T); (s && s.has(c) ? ok : miss).push(`列 ${T}.${c}`) }
  const checkPanel = (c) => { (panels.has(c) ? ok : miss).push('面板 ' + c) }
  for (const m of sql.matchAll(RE.objId)) {
    const n = norm(m[1])
    if (/IF\s+OBJECT_ID\(\s*N?'[^']+'\s*\)\s+IS\s+NULL/i.test(sql.slice(Math.max(0, m.index - 40), m.index + 120))) checkTable(n)
  }
  for (const m of sql.matchAll(RE.createTable)) checkTable(m[1])
  for (const m of sql.matchAll(RE.createView)) checkView(m[1])
  for (const m of sql.matchAll(RE.colLength)) checkCol(m[1], m[2])
  for (const m of sql.matchAll(RE.alterAdd)) checkCol(m[1], m[2])
  for (const m of sql.matchAll(RE.yjPanel)) checkPanel(m[1])
  for (const m of sql.matchAll(RE.yjField)) {
    const vals = m[1].split(',').map((s) => s.trim())
    const p = norm((vals[0] || '').replace(/^N?'|'$/g, ''))
    const c = norm((vals[1] || '').replace(/^N?'|'$/g, ''))
    if (p && c) (fields.has(p + '\u0000' + c) ? ok : miss).push(`字段 ${p}.${c}`)
  }
  const uniq = (a) => [...new Set(a)]
  return { ok: uniq(ok), miss: uniq(miss) }
}

let clean = 0
const dirty = []
for (const it of pending) {
  const { ok, miss } = claimsOf(it.file)
  if (!miss.length) { clean++; it.checked = ok.length } else dirty.push({ ...it, miss, checked: ok.length })
}
console.log(`待执行/待重跑脚本: ${pending.length}(changed ${pending.filter(x=>x.why==='changed').length} / unlogged ${pending.filter(x=>x.why==='unlogged').length})`)
console.log(`声明对象全部已存在: ${clean} 条`)
console.log(`有对象缺失: ${dirty.length} 条`)
const noClaim = pending.filter((it) => !it.checked && !dirty.find((d) => d.name === it.name))
console.log(`无可核对声明(纯 UPDATE/PRINT/数据订正): ${noClaim.length} 条`)
console.log('')
for (const d of dirty) {
  console.log(`#${String(d.idx).padStart(3)} ${d.name}  [${d.why}]  已存在声明 ${d.checked} 项,缺失 ${d.miss.length} 项`)
  d.miss.slice(0, 8).forEach((m) => console.log('        ? ' + m))
  if (d.miss.length > 8) console.log(`        … 还有 ${d.miss.length - 8} 项`)
}
