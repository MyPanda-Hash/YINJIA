/**
 * _dump-change-template.cjs — 把《副本变更模板(1).xlsx》逐 sheet 转成可读网格图(一次性工具)
 * 输出:tools/archive/_walk/src-change-<sheet>.txt
 * 用法:node tools/archive/_dump-change-template.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const XLSX = require('C:/INCER/YINJIA-MES/frontend/node_modules/xlsx')

const SRC = process.env.SRC || 'C:/Users/x1787/OneDrive/Desktop/副本变更模板(1).xlsx'
const OUT = path.join(__dirname, '_walk')
fs.mkdirSync(OUT, { recursive: true })

function colName(n) {
  let s = ''
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

const wb = XLSX.readFile(SRC, { cellStyles: true, sheetStubs: true })
console.log('sheets:', wb.SheetNames.join(' | '))
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name]
  const ref = ws['!ref'] || ''
  const merges = (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m))
  const cols = (ws['!cols'] || []).map((c) => (c && c.wpx ? Math.round(c.wpx) : Math.round(((c && c.wch) || 8) * 7)))
  const rows = (ws['!rows'] || []).map((r) => (r && r.hpx ? Math.round(r.hpx) : 0))
  const cells = {}
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const c = ws[addr]
    if (c && c.v !== undefined && c.v !== null && String(c.v).trim() !== '') cells[addr] = String(c.v)
  }
  const lines = [`════════ change · 表「${name}」 ref=${ref} ════════`]
  if (cols.length) lines.push('列宽(px): ' + cols.map((w, i) => `${colName(i + 1)}=${w}`).join(' '))
  if (rows.length) lines.push('行高(px): ' + rows.map((h, i) => (h ? `${i + 1}=${h}` : '')).filter(Boolean).join(' '))
  if (merges.length) lines.push('合并: ' + merges.join(', '))
  // 逐行输出(只输出有内容的行)
  const byRow = {}
  for (const [addr, v] of Object.entries(cells)) {
    const r = XLSX.utils.decode_cell(addr).r + 1
    ;(byRow[r] = byRow[r] || []).push(`${addr.replace(/\d+$/, '')}=${v.replace(/\n/g, '⏎')}`)
  }
  for (const r of Object.keys(byRow).map(Number).sort((a, b) => a - b)) {
    lines.push(`R${r}: ${byRow[r].join(' ')}`)
  }
  const file = path.join(OUT, `src-change-${name.replace(/[\\/:*?"<>|]/g, '_')}.txt`)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  console.log(`  ${name}: ${Object.keys(cells).length} 格 → ${path.basename(file)}`)
}
