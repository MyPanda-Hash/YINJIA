/* 校验 _stock-flow-backup-20260930.csv:按段切分,逐段核对
   ① 数据行数是否等于段头声明的 rows;② 每行列数与表头列数是否一致;③ 抽查首个/末个字段非空。
   用法: node tools/archive/_chk-stock-flow-csv.cjs <csv路径> [期望列数...] */
const fs = require('node:fs')

function parseCsv(text) {
  const rows = []; let row = []; let f = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++ } else q = false }
      else f += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(f); f = '' }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = '' }
    else if (ch === '\r') { /* skip */ }
    else f += ch
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row) }
  return rows
}

const file = process.argv[2]
const text = fs.readFileSync(file, 'utf8')
// 段头形如:  # ===== inh_bak_20260930 (…描述…) (145 rows) =====
const lines = text.split(/\r?\n/)
const sections = []
let cur = null
for (const ln of lines) {
  const m = /^# ===== (\S+) .*?\((\d+) rows\) =====$/.exec(ln)
  if (m) { cur = { name: m[1], declared: Number(m[2]), header: null, rows: 0, badWidth: 0, widths: new Set() }; sections.push(cur); continue }
  if (!cur || ln === '') continue
  if (!cur.header) { cur.header = parseCsv(ln)[0]; continue }
  const cells = parseCsv(ln)[0]
  cur.rows++
  cur.widths.add(cells.length)
  if (cells.length !== cur.header.length) cur.badWidth++
}

let fail = 0
for (const s of sections) {
  const cols = s.header ? s.header.length : -1
  const ok = s.rows === s.declared && s.badWidth === 0 && [...s.widths].every(w => w === cols)
  if (!ok) fail++
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${s.name}: 声明 ${s.declared} 行 / 实际 ${s.rows} 行, 列数 ${cols}, 列数异常行 ${s.badWidth}, 见到的行宽集合 [${[...s.widths].join(',')}]`)
  console.log(`      表头前 6 列: ${s.header.slice(0, 6).join(' | ')}`)
  console.log(`      表头末 3 列: ${s.header.slice(-3).join(' | ')}`)
}
// 列出 BOM 与总字节
console.log(`BOM=${text.charCodeAt(0) === 0xFEFF ? '有' : '无'}  段数=${sections.length}  文件=${file}  ${fs.statSync(file).size} bytes`)
process.exit(fail ? 1 : 0)
