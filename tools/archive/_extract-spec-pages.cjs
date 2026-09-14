/**
 * _extract-spec-pages.cjs — 解析 8 份规格书 docx 的分页结构
 * 输出每份:总页数/每页标题与表格数(页 = 分页符 w:br type=page 或 sectPr 分割)
 */
const fs = require('fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const DIR = 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.规格书'
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.docx'))
for (const f of files) {
  const key = f.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  const tmp = path.join(__dirname, '_spec-' + key)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  const zip = path.join(tmp, 'd.zip')
  fs.copyFileSync(path.join(DIR, f), zip)
  try {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
    const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
    // 按 body 顶层切分:分页符出现位置
    const body = (xml.match(/<w:body>([\s\S]*)<\/w:body>/) || [])[1] || ''
    // 顶层段落与表格序列 + 分页标记
    const tokens = []
    const re = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>|<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g
    let m
    while ((m = re.exec(body))) {
      if (m[0].startsWith('<w:sectPr')) { tokens.push({ kind: 'sect' }); continue }
      const isTbl = m[0].startsWith('<w:tbl')
      const text = (m[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')
      const pageBreak = /<w:br w:type="page"/.test(m[0]) || /w:pageBreakBefore\/>/.test(m[0])
      tokens.push({ kind: isTbl ? 'tbl' : 'p', text: text.trim(), pageBreak })
    }
    // 组页
    const pages = [[]]
    for (const t of tokens) {
      if (t.kind === 'p' && t.pageBreak && pages[pages.length - 1].length) pages.push([])
      pages[pages.length - 1].push(t)
    }
    const summary = pages.map((pg, i) => {
      const heads = pg.filter((t) => t.kind === 'p' && t.text && t.text.length <= 40 && !/^[0-9.\s]*$/.test(t.text)).slice(0, 3).map((t) => t.text.slice(0, 22))
      const tbls = pg.filter((t) => t.kind === 'tbl').length
      return `P${i + 1}[表${tbls}]${heads.join('/')}`
    })
    console.log('=== ' + f.slice(0, 46))
    console.log('    ' + summary.join(' | '))
    fs.rmSync(tmp, { recursive: true, force: true })
  } catch (e) {
    console.log('=== ' + f + ' PARSE FAIL: ' + e.message.slice(0, 60))
  }
}
