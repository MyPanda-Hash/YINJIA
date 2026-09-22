// 精确解析 INSERT:列名可能含括号(如 齐套数量(主)),值可能含逗号/引号/函数调用
//
// 用途:列出某脚本里「INSERT 的列在当前库 schema 中不存在」的语句 —— 即"重跑必挂"的位置。
// 用法:node tools/archive/_precheck-insert-columns.mjs <schema.tsv> <脚本.sql> [更多脚本.sql ...]
//   schema.tsv 由 sqlcmd 从**目标库**导出(表/视图 → 列):
//     sqlcmd -S localhost -E -I -d HSDZ_MES -f 65001 -h -1 -W -s "`t" -o prod-schema-cols.tsv -Q "SET NOCOUNT ON; SELECT o.type, o.name, c.name FROM sys.columns c JOIN sys.objects o ON o.object_id=c.object_id WHERE o.type IN ('U','V');"
// ⚠ 必须用**目标库**的 schema:测试库与正式库对象可能不同源(2026-09-22 实测测试库 bl_dispatch
//   是英文旧表,拿正式库 schema 预检会得出"零问题"的假结论,随后 DbSync 仍报「列名无效」)。
import fs from 'node:fs'

const schemaFile = 'C:\\INCER\\YINJIA-MES\\tools'
const schema = new Map()
for (const line of fs.readFileSync(process.argv[2], 'utf8').split('\n')) {
  const p = line.trim().split('\t')
  if (p.length !== 3) continue
  const [, obj, col] = p
  if (!obj || !col) continue
  if (!schema.has(obj)) schema.set(obj, new Set())
  schema.get(obj).add(col)
}

/** 从 i 处的 '(' 出发,返回配对 ')' 的下标(跳过单引号内的内容) */
function matchParen(s, i) {
  let depth = 0, inStr = false
  for (let k = i; k < s.length; k++) {
    const c = s[k]
    if (inStr) {
      if (c === "'") { if (s[k + 1] === "'") { k++; continue } inStr = false }
      continue
    }
    if (c === "'") { inStr = true; continue }
    if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0) return k }
  }
  return -1
}

/** 按顶层逗号切分(跳过括号与字符串) */
function splitTop(s) {
  const out = []
  let depth = 0, inStr = false, cur = ''
  for (let k = 0; k < s.length; k++) {
    const c = s[k]
    if (inStr) {
      cur += c
      if (c === "'") { if (s[k + 1] === "'") { cur += s[k + 1]; k++; continue } inStr = false }
      continue
    }
    if (c === "'") { inStr = true; cur += c; continue }
    if (c === '(') depth++
    if (c === ')') depth--
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue }
    cur += c
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

for (const file of process.argv.slice(3)) {
  const sql = fs.readFileSync(file, 'utf8')
  const lines = sql.split('\n')
  console.log(`\n########## ${file} ##########`)
  lines.forEach((line, ln) => {
    const m = /INSERT\s+INTO\s+([\w\u4e00-\u9fa5]+)\s*\(/i.exec(line)
    if (!m) return
    const tbl = m[1]
    const open = line.indexOf('(', m.index + m[0].length - 1)
    const close = matchParen(line, open)
    if (close < 0) { console.log(`  L${ln + 1} ${tbl}: 括号不配对(跳过)`); return }
    const cols = splitTop(line.slice(open + 1, close)).map((c) => c.replace(/^\[|\]$/g, '').trim())
    const tcols = schema.get(tbl)
    if (!tcols) { console.log(`  L${ln + 1} ${tbl}: 表不在 schema(忽略)`); return }
    const miss = cols.filter((c) => !tcols.has(c))
    if (miss.length) {
      console.log(`  L${ln + 1} ${tbl}: 列数 ${cols.length}, 缺列 -> ${miss.join(' , ')}`)
      miss.forEach((c) => console.log(`           该列在 INSERT 里的位置(1-based): ${cols.indexOf(c) + 1}`))
    }
  })
}
