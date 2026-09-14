/**
 * _walk-sources.cjs — 产品文件 7 面板走查:源文档结构提取(xlsx 网格地图 / docx 文本+表格)
 * 输出: tools/_walk/src-*.txt(可读网格地图)+ src-*.json(原始结构)
 * 用法: node tools/_walk-sources.cjs
 */
const fs = require('fs')
const path = require('path')
const XLSX = require(path.join(__dirname, '../frontend/node_modules/xlsx'))
const { execSync } = require('child_process')

const ROOT = 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件'
const OUT = path.join(__dirname, '_walk')
fs.mkdirSync(OUT, { recursive: true })

const XLSX_SRC = {
  prodInfo: `${ROOT}/1.产品信息表/产品信息表内容.xlsx`,
  moldFormula: `${ROOT}/2.成型工艺文件系统需求框架-v0.1/20267月22日-最新烧结配方模板-1.xlsx`,
  sampleTemplate: `${ROOT}/2.成型工艺文件系统需求框架-v0.1/系统样品模板.xlsx`,
  specSub: `${ROOT}/2.1规格书/规格书细分.xlsx`,
  specTests: `${ROOT}/2.1规格书/测试项目汇总.xlsx`,
  inspPlan: `${ROOT}/3.检验计划表/出货检验项目控制计划.xlsx`,
}
const DOCX_SRC = {
  docReq: `${ROOT}/2.成型工艺文件系统需求框架-v0.1/系统设计需求0903.docx`,
  docAsm: `${ROOT}/2.组装/组装段BOM和工艺控制.docx`,
}

function colName(n) {
  let s = ''
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

function dumpXlsx(key, file) {
  const wb = XLSX.readFile(file, { cellStyles: true, sheetStubs: true })
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name]
    const merges = (ws['!merges'] || []).map((m) => XLSX.utils.encode_range(m))
    const cols = (ws['!cols'] || []).map((c) => (c && c.wpx ? Math.round(c.wpx) : Math.round((c && c.wch || 8) * 7)))
    const cells = {}
    for (const addr of Object.keys(ws)) {
      if (addr.startsWith('!')) continue
      const c = ws[addr]
      if (c && c.v !== undefined && c.v !== null && String(c.v).trim() !== '') cells[addr] = String(c.v)
    }
    // 网格地图:按行输出有内容的单元格
    const lines = []
    lines.push(`════════ ${key} · 表「${name}」 ref=${ws['!ref'] || ''} ════════`)
    lines.push(`列宽(px): ${cols.map((w, i) => colName(i + 1) + '=' + w).join(' ')}`)
    lines.push(`合并: ${merges.join(', ')}`)
    const rowMap = {}
    for (const [addr, v] of Object.entries(cells)) {
      const m = addr.match(/^([A-Z]+)(\d+)$/)
      if (!m) continue
      const r = Number(m[2])
      ;(rowMap[r] = rowMap[r] || []).push({ col: m[1], v })
    }
    for (const r of Object.keys(rowMap).sort((a, b) => a - b)) {
      const cs = rowMap[r].sort((a, b) => a.col.localeCompare(b.col))
      lines.push(`R${r}: ` + cs.map((c) => `[${c.col}]=${c.v.replace(/\n/g, '⏎').replace(/\s+/g, ' ').slice(0, 80)}`).join(' '))
    }
    fs.writeFileSync(path.join(OUT, `src-${key}-${name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.txt`), lines.join('\n'), 'utf8')
    fs.writeFileSync(path.join(OUT, `src-${key}-${name.replace(/[^\w\u4e00-\u9fa5]/g, '_')}.json`), JSON.stringify({ ref: ws['!ref'], merges, cols, cells }, null, 1), 'utf8')
    console.log(`[xlsx] ${key} · ${name}: ${Object.keys(cells).length} cells / ${merges.length} merges`)
  }
}

function dumpDocx(key, file) {
  const tmp = path.join(OUT, 'docx-' + key)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  fs.copyFileSync(file, path.join(tmp, 'd.zip'))
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tmp}\\d.zip' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
  const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
  const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1]
  const lines = [`════════ ${key} (docx) ════════`]
  const re = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>/g
  let m
  while ((m = re.exec(body))) {
    if (!m[0].startsWith('<w:tbl')) {
      const text = (m[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('').trim()
      if (text) lines.push(text)
    } else {
      const rows = [...m[0].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)]
      lines.push(`──表格(${rows.length}行)──`)
      rows.forEach((rm) => {
        const cells = [...(rm[1] || '').matchAll(/<w:tc>([\s\S]*?)<\/w:tc>/g)].map((cm) => ((cm[1].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')).trim().replace(/\s+/g, ' '))
        lines.push('  ' + cells.join(' | '))
      })
    }
  }
  fs.writeFileSync(path.join(OUT, `src-${key}.txt`), lines.join('\n'), 'utf8')
  console.log(`[docx] ${key}: ${lines.length} lines`)
}

for (const [k, f] of Object.entries(XLSX_SRC)) dumpXlsx(k, f)
for (const [k, f] of Object.entries(DOCX_SRC)) dumpDocx(k, f)
console.log('DONE → ' + OUT)
