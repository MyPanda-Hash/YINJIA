/**
 * _extract-spec-heads.cjs — 提取 8 份规格书的编号章节标题(1.适用范围/2.整体规格参数…)与表格标题
 */
const fs = require('fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const DIR = 'C:/Users/x1787/OneDrive/Desktop/收集客户资料/产品开发/2.产品文件/2.规格书'
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.docx'))
for (const f of files) {
  const key = f.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)
  const tmp = path.join(__dirname, '_sp-' + key)
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  const zip = path.join(tmp, 'd.zip')
  fs.copyFileSync(path.join(DIR, f), zip)
  try {
    execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zip}' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
    const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
    const paras = [...xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((m) => ({
      text: (m[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('').trim(),
      pageBreak: /<w:br w:type="page"/.test(m[0]),
    })).filter((p) => p.text)
    // 编号章节 + 关键标题
    const heads = paras.filter((p) => /^[0-9]{1,2}[.、．]/.test(p.text) || /^(修订记录|物料清单|技术要求|检验要求)/.test(p.text)).map((p) => p.text.slice(0, 42))
    // 表格首行(表头)
    const tblHeads = [...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((tm) => {
      const firstRow = (tm[0].match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/) || [''])[0]
      return (firstRow.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('/').slice(0, 50)
    })
    console.log('=== ' + f.slice(0, 44))
    console.log('  章节: ' + heads.join(' | '))
    console.log('  表格: ' + tblHeads.join('  ‖  '))
    fs.rmSync(tmp, { recursive: true, force: true })
  } catch (e) {
    console.log('=== ' + f + ' FAIL ' + e.message.slice(0, 50))
  }
}
