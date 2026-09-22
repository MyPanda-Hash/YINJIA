/* _xlsx-dump2.cjs — 参考文档 xlsx 页签完整解析(合并单元格 + 共享串准确解引用)
   用法: node tools/archive/_probe-qc-insp-rec/_xlsx-dump2.cjs <xlsx路径> <sheetN.xml>
   与 _xlsx-dump.cjs 的差别:① 共享串按 <si> 全量精确建表(富文本 run 拼接);
   ② 合并单元格逐块打印(锚点值 + 覆盖范围),便于照版式落库;③ 打印每个单元格的样式号(便于识别表头底纹)。*/
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFileSync } = require('node:child_process')

const xlsxPath = process.argv[2]
const sheetFile = process.argv[3] || 'sheet1.xml'
const tmp = path.join(os.tmpdir(), 'xlsx_dump2_' + Date.now())
fs.mkdirSync(tmp, { recursive: true })
try {
  execFileSync('unzip', ['-o', xlsxPath, '-d', tmp], { stdio: 'ignore' })
} catch (e) {
  if (e.code !== 'ENOENT') throw e
  const zip = path.join(tmp, '_book.zip')
  fs.copyFileSync(xlsxPath, zip)
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force`], { stdio: 'ignore' })
}

const unesc = (s) => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
  .replace(/&amp;/g, '&')

// 共享串:每个 <si> 内所有 <t> 拼接
const sstXml = fs.readFileSync(path.join(tmp, 'xl', 'sharedStrings.xml'), 'utf8')
const sst = [...sstXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')))

const xml = fs.readFileSync(path.join(tmp, 'xl', 'worksheets', sheetFile), 'utf8')
const colToNum = (letters) => { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n }
const numToCol = (n) => { let s = ''; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) } return s }

const cells = new Map()
let maxR = 0, maxC = 0
for (const rm of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const r = +rm[1]
  for (const cm of rm[2].matchAll(/<c\s+r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = cm[1] + cm[2]
    const attrs = cm[3] || ''
    const body = cm[4] || ''
    const vm = body.match(/<v>([\s\S]*?)<\/v>/)
    const tm = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)
    let val = ''
    if (/t="s"/.test(attrs) && vm) val = sst[+vm[1]] ?? `<未解析sst:${vm[1]}>`
    else if (/t="inlineStr"/.test(attrs) && tm) val = unesc(tm[1])
    else if (vm) val = vm[1]
    else if (tm) val = unesc(tm[1])
    const style = (attrs.match(/s="(\d+)"/) || [])[1] || ''
    if (val !== '') {
      cells.set(ref, { val, style })
      maxR = Math.max(maxR, +cm[2]); maxC = Math.max(maxC, colToNum(cm[1]))
    }
  }
}

const merges = [...xml.matchAll(/<mergeCell ref="([^"]+)"/g)].map((m) => m[1])
console.log(`临时目录: ${tmp}`)
console.log(`范围: ${maxR} 行 × ${maxC} 列`)
console.log('=== 合并单元格(锚点值 → 覆盖范围) ===')
for (const m of merges) {
  const [a, b] = m.split(':')
  const c = cells.get(a)
  console.log(`  ${m.padEnd(10)} ${c ? JSON.stringify(c.val) : '(空)'}${c && c.style ? ' [s=' + c.style + ']' : ''}`)
}
console.log('=== 网格(逐行) ===')
for (let r = 1; r <= maxR; r++) {
  const parts = []
  for (let c = 1; c <= maxC; c++) {
    const ref = numToCol(c) + r
    const cell = cells.get(ref)
    if (cell) parts.push(`${ref}=${JSON.stringify(cell.val)}${cell.style ? '(s' + cell.style + ')' : ''}`)
  }
  if (parts.length) console.log(`r${r}: ` + parts.join(' | '))
}
