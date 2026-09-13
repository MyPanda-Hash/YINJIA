/**
 * _extract-asm2-tables.cjs — 组装段BOM和工艺控制.docx 表格完整提取
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const f = 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.组装/组装段BOM和工艺控制.docx'
const tmp = 'C:/INCER/.bak-analysis/asm2'
fs.rmSync(tmp, { recursive: true, force: true })
fs.mkdirSync(tmp, { recursive: true })
fs.copyFileSync(f, path.join(tmp, 'd.zip'))
execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tmp}\\d.zip' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)]
tables.forEach((tm, ti) => {
  const rows = [...tm[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)]
  console.log('══ 表' + ti + ' (' + rows.length + '行) ══')
  rows.forEach((rm, ri) => {
    const cells = [...(rm[1] || '').matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((cm) => ((cm[1].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')).trim().replace(/\s+/g, ' ').slice(0, 42))
    console.log('  R' + ri + ': ' + cells.join(' | ').slice(0, 210))
  })
})
