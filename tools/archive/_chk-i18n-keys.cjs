/**
 * _chk-i18n-keys.cjs — 判断某语言的词条是「真缺」还是「译文与中文相同」(2026-10-24)
 * 用法:node tools/archive/_chk-i18n-keys.cjs <locale> key1 key2 …
 */
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..', '..')
const loc = process.argv[2]
const keys = process.argv.slice(3)
const file = path.join(ROOT, 'frontend', 'src', 'i18n', 'locales', `${loc}.js`)
const text = fs.readFileSync(file, 'utf8')
const missing = []
for (const k of keys) {
  const re = new RegExp(`^\\s*(['"])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`, 'm')
  if (!re.test(text)) missing.push(k)
}
console.log(`${loc}: 真缺 ${missing.length} 条 → ${missing.join(' / ') || '(无)'}`)
