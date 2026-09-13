/**
 * gen-spec-section-lib.cjs — 从《规格书示例》docx 提取章节文案,生成规格书章节标准库种子
 * 提取: 1.适用范围 / 2.整体规格参数 / 3.产品主要性能 / 6.包装方式 / 7.运输要求 / 8.存储环境
 * 输出: tools/_walk/spec-section-lib.generated.js(去重后的条目,供迁移 SQL 生成)
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const DIR = 'C:/Users/x1787/OneDrive/Desktop/产品开发/2.产品文件/2.1规格书/规格书示例'
const SECTIONS = ['1.适用范围', '2.整体规格参数', '3.产品主要性能', '6.包装方式', '7.运输要求', '8.存储环境']
// 终止标签:遇到任何「数字.」章节头即停(4.检验标准表/5.关键物料列表等)
const STOP_RE = /^[1-9]\s*[．.、]/
const LABEL_RE = /^(1\s*[．.]\s*适用范围|2\s*[．.]\s*整体规格参数|3\s*[．.]\s*产品主要性能|6\s*[．.]\s*包装方式|7\s*[．.]\s*运输要求|8\s*[．.]\s*存储环境)\s*[：:]?\s*/
const tmpBase = path.join(__dirname, '_walk', 'docx-seclib')

function docText(file) {
  const tmp = path.join(tmpBase, path.basename(file, '.docx'))
  fs.rmSync(tmp, { recursive: true, force: true })
  fs.mkdirSync(tmp, { recursive: true })
  fs.copyFileSync(file, path.join(tmp, 'd.zip'))
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${tmp}\\d.zip' -DestinationPath '${tmp}\\x' -Force"`, { stdio: 'ignore' })
  const xml = fs.readFileSync(path.join(tmp, 'x', 'word', 'document.xml'), 'utf8')
  // 段落拼接:每段一行,段内 runs 连接
  const paras = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map((m) =>
    [...m[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join('')
  )
  return paras.join('\n')
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.docx'))
const entries = {} // section -> Set of text
for (const s of SECTIONS) entries[s] = new Set()

for (const f of files) {
  try {
    const text = docText(path.join(DIR, f))
    const lines = text.split('\n').map((l) => l.trim())
    for (let i = 0; i < lines.length; i++) {
      const norm = lines[i].replace(/\s+/g, '')
      const hit = SECTIONS.find((s) => norm.startsWith(s.replace(/\s+/g, '')))
      if (!hit) continue
      // 取标签后的同行剩余 + 后续行(遇到任何下一个章节头即停)
      let val = lines[i].replace(LABEL_RE, '').trim()
      const collected = []
      if (val) collected.push(val)
      for (let j = i + 1; j < lines.length; j++) {
        if (STOP_RE.test(lines[j])) break
        if (lines[j]) collected.push(lines[j])
      }
      const full = collected.join('\n').trim().replace(/物品物品/g, '物品')
      if (full && full.length > 1) entries[hit].add(full)
    }
  } catch (e) {
    console.log('SKIP ' + f + ': ' + e.message)
  }
}

const out = {}
for (const s of SECTIONS) out[s] = [...entries[s]]
fs.writeFileSync(path.join(__dirname, '_walk', 'spec-section-lib.generated.js'), '// 由 gen-spec-section-lib.cjs 从《规格书示例》提取\nmodule.exports = ' + JSON.stringify(out, null, 1) + '\n', 'utf8')
for (const s of SECTIONS) console.log(s + ': ' + out[s].length + ' 条')
out['7.运输要求'].concat(out['8.存储环境']).slice(0, 4).forEach((t) => console.log('  示例: ' + t.slice(0, 40)))
