// _xlsx-dump.cjs — 把 xlsx 某个 sheet 渲染成带合并信息的文本网格(解析参考文档用)
// 用法: node tools/archive/_xlsx-dump.cjs <xlsx路径> <sheetN>
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFileSync } = require('child_process')

const xlsx = process.argv[2]
const sheetFile = process.argv[3] || 'sheet12.xml'
const tmp = path.join(os.tmpdir(), 'xlsx_dump_' + Date.now())
fs.mkdirSync(tmp, { recursive: true })
// 解压:优先 unzip(类 Unix);Windows 无 unzip 时回退 PowerShell Expand-Archive,
// 这样本工具在没有 unzip 的机器上也能用(2026-09-22 在 Win 上实测 unzip ENOENT)。
try {
  execFileSync('unzip', ['-o', xlsx, '-d', tmp], { stdio: 'ignore' })
} catch (e) {
  if (e.code !== 'ENOENT') throw e
  const zip = path.join(tmp, '_book.zip')
  fs.copyFileSync(xlsx, zip)
  execFileSync('powershell', ['-NoProfile', '-Command',
    `Expand-Archive -LiteralPath '${zip}' -DestinationPath '${tmp}' -Force`], { stdio: 'ignore' })
}

const sharedXml = fs.readFileSync(path.join(tmp, 'xl/sharedStrings.xml'), 'utf8')
const strs = []
for (const m of sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  let s = ''
  for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += t[1]
  strs.push(
    s
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
      .replace(/&amp;/g, '&')
  )
}

const sheetXml = fs.readFileSync(path.join(tmp, 'xl/worksheets', sheetFile), 'utf8')

// 合并单元格
const merges = []
for (const m of sheetXml.matchAll(/<mergeCell ref="([^"]+)"/g)) merges.push(m[1])

// 行列 -> 值
const cells = new Map()
let maxR = 0,
  maxC = 0
const colIdx = (ref) => {
  const letters = ref.match(/^[A-Z]+/)[0]
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}
for (const rm of sheetXml.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const r = +rm[1]
  for (const cm of rm[2].matchAll(/<c\s+r="([A-Z]+\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const ref = cm[1]
    const attrs = cm[2] || ''
    const body = cm[3] || ''
    const c = colIdx(ref)
    let val = ''
    const vm = body.match(/<v>([\s\S]*?)<\/v>/)
    const tm = body.match(/<t[^>]*>([\s\S]*?)<\/t>/)
    if (/t="s"/.test(attrs) && vm) val = strs[+vm[1]] ?? ''
    else if (/t="inlineStr"/.test(attrs) && tm) val = tm[1]
    else if (vm) val = vm[1]
    else if (tm) val = tm[1]
    const isF = /<f[^>]*>/.test(body)
    if (val !== '' || isF) {
      cells.set(ref, isF ? val + ' ⟨公式⟩' : val)
      maxR = Math.max(maxR, r)
      maxC = Math.max(maxC, c)
    }
  }
}

console.log('临时目录:', tmp)
console.log('合并单元格:', merges.join(' , ') || '(无)')
console.log('范围: ' + maxR + ' 行 × ' + maxC + ' 列')
console.log('=== 网格 ===')
for (let r = 1; r <= maxR; r++) {
  const parts = []
  for (let c = 1; c <= maxC; c++) {
    const ref = String.fromCharCode(64 + c) + r
    const v = cells.get(ref)
    if (v) parts.push(ref + '=' + JSON.stringify(v))
  }
  if (parts.length) console.log('r' + r + ': ' + parts.join(' | '))
}
