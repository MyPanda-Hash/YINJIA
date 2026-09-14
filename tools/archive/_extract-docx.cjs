/**
 * _extract-docx.cjs — 提取产品文件 Word 表格结构(BOM/组装工艺/规格书)
 * docx = zip;word/document.xml 的 w:tbl/w:tr/w:tc 提取文本与合并(gridSpan/vMerge)
 */
const fs = require('fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const FILES = {
  asmBom: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.组装/BOM表.docx',
  asmProc: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.组装/工艺清单.docx',
  spec1: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.规格书/B-85-06 炭棒规格书-28-12-110.docx',
  spec2: 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.规格书/C-95-13~21伊可普除铅炭棒规格书（006项目）-内部使用 新.docx',
}

function extractDocx(file, key) {
  const tmp = path.join(__dirname, '_docx-' + key)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  const zip = path.join(tmp, 'd.zip')
  fs.copyFileSync(file, zip)
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${tmp}\\x' -Force"`)
  const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
  // 段落(表格外的正文)
  const paras = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)]
    .map((m) => (m[1].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join(''))
    .filter((t) => t.trim())
  // 表格
  const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)].map((tm) => {
    const rows = [...tm[1].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)].map((rm) => {
      const cells = [...rm[1].matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((cm) => {
        const text = (cm[1].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')
        const span = (cm[1].match(/<w:gridSpan w:val="(\d+)"/) || [])[1]
        const vmerge = /<w:vMerge\/>/.test(cm[1]) ? 'cont' : /<w:vMerge w:val="restart"/.test(cm[1]) ? 'restart' : ''
        return { t: text.trim(), s: span || '', v: vmerge }
      })
      return cells
    })
    return rows
  })
  const out = { paras, tables }
  fs.writeFileSync(path.join(__dirname, '_prod-dump-' + key + '.json'), JSON.stringify(out, null, 1), 'utf8')
  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('=== ' + key + ' === paras=' + paras.length + ' tables=' + tables.length)
  tables.forEach((t, i) => console.log('  table' + i + ': ' + t.length + '行 × 首行' + (t[0] ? t[0].length : 0) + '格'))
}

for (const [key, f] of Object.entries(FILES)) extractDocx(f, key)
