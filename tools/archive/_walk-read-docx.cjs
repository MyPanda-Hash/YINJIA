/** _walk-read-docx.cjs — 读取 Word 文档内容(段落+表格,保持结构) */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const FILE = process.argv[2] || 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.组装/组装段BOM和工艺控制.docx'
const tmp = path.join(__dirname, '_walk', 'docx-read')
fs.rmSync(tmp, { recursive: true, force: true })
fs.mkdirSync(tmp, { recursive: true })
fs.copyFileSync(FILE, path.join(tmp, 'd.zip'))
execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tmp}\\d.zip' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || ''
const re = /<w:(p|tbl)\b[^>]*>([\s\S]*?)<\/w:\1>/g
let m
let tableNo = 0
while ((m = re.exec(body))) {
  if (m[1] === 'p') {
    const text = (m[2].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('').trim()
    if (text) console.log(text)
  } else {
    tableNo++
    const rows = [...m[2].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)]
    console.log(`\n─── 表格 ${tableNo}(${rows.length} 行)───`)
    rows.forEach((rm, ri) => {
      const cells = [...(rm[1] || '').matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)].map(cm =>
        ((cm[1].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map(t => t.replace(/<[^>]+>/g, '')).join('')).trim().replace(/\s+/g, ' ')
      )
      console.log(`  ${ri === 0 ? 'HDR' : String(ri).padStart(3)} | ` + cells.join(' | '))
    })
    console.log('')
  }
}
console.log(`\n共 ${tableNo} 个表格`)
