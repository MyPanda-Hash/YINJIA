/**
 * _q-i18n-keys.mjs — 只读:「库存口径提示」的两句中文在 en/ja/zh-TW 里是否都能查到译名
 * 由来:AGENTS「多语言强制规范」——新增显示层文案必须同时交付译名,否则切英语就露中文。
 * 用法:node tools/archive/_erp-stock-sync-20261110/_q-i18n-keys.mjs
 */
import { STOCK_HINT_TEXT } from '../../../frontend/src/core/views/stockHint.js'

const files = ['en.js', 'ja.js', 'zh-TW.js']
let bad = 0
for (const f of files) {
  const mod = await import(new URL(`../../../frontend/src/i18n/locales/${f}`, import.meta.url))
  const biz = (mod.default && mod.default.biz) || {}
  for (const [code, key] of Object.entries(STOCK_HINT_TEXT)) {
    const hit = biz[key]
    if (!hit) { bad++; console.log(`[FAIL] ${f} | ${code} | 缺译名`); continue }
    console.log(`[OK]   ${f} | ${code} | ${String(hit).slice(0, 60)}`)
  }
}
console.log(bad === 0 ? '\nRESULT: PASS(6/6 命中)' : `\nRESULT: FAIL(${bad} 处缺译名)`)
process.exitCode = bad === 0 ? 0 : 1
