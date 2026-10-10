/**
 * _q-docx.mjs — 读 word/document.xml,按顺序列出「段落文字 / 图片引用」(读懂用户已建好的文档结构)
 * 用法: node tools/archive/_wms-doc-shots/_q-docx.mjs "<docx 解压目录>\word\document.xml"
 */
import fs from 'node:fs'

const file = process.argv[2]
const xml = fs.readFileSync(file, 'utf8')
// 关系表:rId → media 文件名
const rels = fs.readFileSync(file.replace(/document\.xml$/, '_rels\\document.xml.rels'), 'utf8')
const media = {}
for (const m of rels.matchAll(/Id="([^"]+)"[^>]*Target="media\/([^"]+)"/g)) media[m[1]] = m[2]

const paras = xml.split(/<w:p[ >]/).slice(1)
let n = 0
for (const p of paras) {
  n++
  const text = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  const imgs = [...p.matchAll(/r:embed="([^"]+)"/g)].map((m) => media[m[1]] || m[1])
  const drawings = (p.match(/<w:drawing>/g) || []).length
  if (!text.trim() && !imgs.length && !drawings) continue
  console.log(`[${String(n).padStart(3)}] ${text.trim() ? text.trim().slice(0, 120) : '(无文字)'}${imgs.length ? '  🖼 ' + imgs.join(',') : ''}${!imgs.length && drawings ? '  🖼(无 r:embed)' : ''}`)
}
