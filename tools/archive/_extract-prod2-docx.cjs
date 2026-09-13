/**
 * _extract-prod2-docx.cjs — 提取产品文件 v2 两个 Word 文档内容
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const FILES = [
  ['系统设计需求0903', 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.成型工艺文件系统需求框架-v0.1/系统设计需求0903.docx'],
  ['组装段BOM和工艺控制', 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.组装/组装段BOM和工艺控制.docx'],
]
for (const [key, f] of FILES) {
  const tmp = path.join('C:/INCER/.bak-analysis', 'pd2-' + key)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  fs.copyFileSync(f, path.join(tmp, 'd.zip'))
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tmp}\\d.zip' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
  const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
  const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1]
  console.log('════════ ' + key + ' ════════')
  const re = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>/g
  let m
  while ((m = re.exec(body))) {
    if (!m[0].startsWith('<w:tbl')) {
      const text = (m[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('').trim()
      if (text) console.log('  ' + text.slice(0, 160))
    } else {
      const rows = [...m[0].matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)]
      console.log('  [表格 ' + rows.length + ' 行]')
      rows.slice(0, 40).forEach((rm) => {
        const cells = [...(rm[1] || '').matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((cm) => ((cm[1].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')).trim().replace(/\s+/g, ' ').slice(0, 34))
        console.log('    ' + cells.join(' | ').slice(0, 230))
      })
    }
  }
}
