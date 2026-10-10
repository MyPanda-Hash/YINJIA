/**
 * _q-docx-style.mjs — 看用户文档里「标题/子标题/图片」的排版参数(照着同样版式续写 WMS 一节)
 * 用法: node tools/archive/_wms-doc-shots/_q-docx-style.mjs "<解压目录>\word\document.xml"
 */
import fs from 'node:fs'

const file = process.argv[2]
const xml = fs.readFileSync(file, 'utf8')
const paras = xml.split(/<w:p[ >]/).slice(1)
const textOf = (p) => [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('')
for (const [i, p] of paras.entries()) {
  const t = textOf(p).trim()
  const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0]
  const rPr = [...p.matchAll(/<w:rPr>[\s\S]*?<\/w:rPr>/g)].map((m) => m[0])[0] || ''
  const ext = (p.match(/<wp:extent[^>]*>/) || [''])[0]
  if (!t && !ext) continue
  if (i > 40) break
  const clean = (s) => s.replace(/<w:rFonts[^>]*>/g, '').replace(/\s+/g, ' ')
  if (/[一二三四五六七八]．/.test(t)) console.log(`\n=== 顶级标题 [${i}] ${t}\n  pPr: ${clean(pPr).slice(0, 300)}\n  rPr: ${clean(rPr).slice(0, 200)}`)
  else if (/[^\s]/.test(t) && t.length < 20) console.log(`--- 子标题 [${i}] ${t}\n  pPr: ${clean(pPr).slice(0, 200)}\n  rPr: ${clean(rPr).slice(0, 200)}`)
  else if (ext) console.log(`    🖼 [${i}] ${ext}  pPr: ${clean(pPr).slice(0, 160)}`)
}
