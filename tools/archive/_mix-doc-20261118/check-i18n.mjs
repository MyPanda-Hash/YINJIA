/**
 * 列出两个扫码混料页面上 tt('…') 用到的中文词条,哪些在 en.js / ja.js 里还缺译名。
 *
 * 用法(仓库根):node tools/archive/_mix-doc-20261118/check-i18n.mjs
 * 与 frontend/src/business/mixScan.test.js 的「文案都有英文译名」那条断言同一口径。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const pages = [
  'frontend/src/views/mobile/MobileMixScan.vue',
  'frontend/src/views/mobile/MobileMixDoc.vue',
]
const locales = ['en', 'ja']

const keys = new Set()
for (const p of pages) {
  const src = readFileSync(join(root, p), 'utf8')
  for (const m of src.matchAll(/tt\('([^']+)'\)/g)) keys.add(m[1])
  // 多行 tt('…') 也认(Vue 模板里偶有换行)
  for (const m of src.matchAll(/tt\(\s*'([^']+)'\s*\)/g)) keys.add(m[1])
}

for (const loc of locales) {
  const dict = readFileSync(join(root, `frontend/src/i18n/locales/${loc}.js`), 'utf8')
  const missing = [...keys].filter((k) => !dict.includes(`'${k}'`) && !dict.includes(`"${k}"`)).sort()
  console.log(`\n=== ${loc} 缺 ${missing.length} 条 ===`)
  for (const k of missing) console.log(`  ${k}`)
}
console.log(`\n合计 tt() 词条 ${keys.size} 条`)
