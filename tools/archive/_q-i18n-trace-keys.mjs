/*
 * 一次性自检(2026-10-16):核对 WorkOrderTraceDialog.vue 里所有 tt('…') 键在 en.js 有译名。
 * (AGENTS.md 多语言强制规范:显示层文案必须能切到英文,不得裸中文。)
 * 用法: node tools/archive/_q-i18n-trace-keys.mjs
 */
import fs from 'node:fs'

const vue = fs.readFileSync('frontend/src/views/modules/plan/WorkOrderTraceDialog.vue', 'utf8')
const en = fs.readFileSync('frontend/src/i18n/locales/en.js', 'utf8')

// 模板里的 tt('中文') 与 :label="tt('中文')";排除 tt(变量) 与 tt(x['…'])
const keys = [...vue.matchAll(/\btt\(\s*'([^']+)'\s*\)/g)].map((m) => m[1])
const uniq = [...new Set(keys)].sort()

const missing = uniq.filter((k) => {
  // en.js 里形如 '中文': 'English'
  const re = new RegExp(`'${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:`)
  return !re.test(en)
})

console.log(`模板 tt() 键共 ${uniq.length} 个(去重)`)
console.log(`en.js 缺失 ${missing.length} 个:`)
for (const m of missing) console.log('   ✗ ' + m)
process.exit(missing.length === 0 ? 0 : 1)
