/*
 * _check-i18n-keys.mjs — 校验某个 .vue 里所有 tt('...') 词条在 en.js 的 biz 词典里是否存在。
 * 用法: node tools/archive/_check-i18n-keys.mjs frontend/src/core/qc/QcInspPlanDialog.vue [额外词条...]
 * 只读。缺的词条直接打印成可粘贴的 en 片段(占位译文留空,人工填)。
 */
import fs from 'node:fs'

const vue = process.argv[2]
const extra = process.argv.slice(3)
const src = fs.readFileSync(vue, 'utf8')

// tt('xxx') / tt("xxx") —— 只取字面量,跳过含变量的表达式
const keys = new Set(extra)
for (const m of src.matchAll(/\btt\(\s*(['"])((?:\\.|(?!\1).)*)\1\s*\)/g)) keys.add(m[2])

const en = fs.readFileSync('frontend/src/i18n/locales/en.js', 'utf8')
const miss = []
for (const k of keys) {
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // biz 词典里的键: '中文': 或 "中文":
  const re = new RegExp(`(['"])${esc}\\1\\s*:`)
  if (!re.test(en)) miss.push(k)
}
console.log(`词条 ${keys.size} 条,缺 en ${miss.length} 条:`)
for (const k of miss) console.log('  ' + k)
if (miss.length) {
  console.log('\n可粘贴片段:')
  for (const k of miss) console.log(`    '${k.replace(/'/g, "\\'")}': '',`)
}
process.exit(miss.length ? 1 : 0)
