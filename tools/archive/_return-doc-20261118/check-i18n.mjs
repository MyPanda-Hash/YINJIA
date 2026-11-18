/**
 * check-i18n.mjs — 列出几个手机页面里 tt('…') 用到的中文词条,哪些在 en.js / ja.js 里还缺译名。
 *
 * 用法(仓库根):
 *   node tools/archive/_return-doc-20261118/check-i18n.mjs [页面相对路径 ...]
 * 不传参数时默认查本次改动的三页(生产退料列表 / 生产退料单明细 / 生产领料单)。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const pages = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'frontend/src/views/mobile/MobileReturnList.vue',
      'frontend/src/views/mobile/MobileReturnDoc.vue',
      'frontend/src/views/mobile/MobilePickDoc.vue',
    ]
const locales = ['en', 'ja']

const keys = new Set()
for (const p of pages) {
  const src = readFileSync(join(root, p), 'utf8')
  for (const m of src.matchAll(/tt\(\s*'([^']+)'\s*\)/g)) keys.add(m[1])
}

for (const loc of locales) {
  const dict = readFileSync(join(root, `frontend/src/i18n/locales/${loc}.js`), 'utf8')
  const missing = [...keys].filter((k) => !dict.includes(`'${k}'`) && !dict.includes(`"${k}"`)).sort()
  console.log(`\n=== ${loc} 缺 ${missing.length} 条 ===`)
  for (const k of missing) console.log(`  ${k}`)
}
console.log(`\n合计 tt() 词条 ${keys.size} 条(页面 ${pages.length} 个)`)
