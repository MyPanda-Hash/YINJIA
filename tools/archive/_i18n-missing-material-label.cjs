/**
 * _i18n-missing-material-label.cjs — 列出本次新增 UI 文案里**尚未登记**的词条。
 * 用法(仓库根):node tools/archive/_i18n-missing-material-label.cjs
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const ROOT = path.resolve(__dirname, '..', '..')
const FILES = [
  'frontend/src/core/views/MaterialLabelDialog.vue',
  'frontend/src/core/views/BatchSendDialog.vue',
  'frontend/src/core/views/PanelxList.vue',
]
const LOCALES = ['en', 'zh-TW']
const keys = new Set()
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
  for (const m of src.matchAll(/\btt\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1].replace(/\\'/g, "'"))
}
const existing = (loc) => {
  const src = fs.readFileSync(path.join(ROOT, `frontend/src/i18n/locales/${loc}.js`), 'utf8')
  const set = new Set()
  for (const m of src.matchAll(/^\s*'((?:[^'\\]|\\.)*)'\s*:/gm)) set.add(m[1].replace(/\\'/g, "'"))
  for (const m of src.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) set.add(m[1].replace(/\\"/g, '"'))
  return set
}
for (const loc of LOCALES) {
  const have = existing(loc)
  const missing = [...keys].filter((k) => !have.has(k)).sort()
  console.log(`\n=== ${loc}:缺 ${missing.length} 条(共扫到 ${keys.size} 条) ===`)
  for (const k of missing) console.log(JSON.stringify(k))
}
