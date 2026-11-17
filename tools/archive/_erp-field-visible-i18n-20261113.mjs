/*
 * _erp-field-visible-i18n-20261113.mjs —— ERP 字段下拉「（界面上已隐藏）」标记,10 语言
 * 用法(仓库根):node tools/archive/_erp-field-visible-i18n-20261113.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')
const KEY = '（界面上已隐藏）'
const T = {
  en: ' (hidden in UI)',
  ja: '（画面上は非表示）',
  ko: ' (화면에서 숨김)',
  de: ' (in der Oberfläche ausgeblendet)',
  es: ' (oculto en la interfaz)',
  fr: ' (masqué dans l’interface)',
  ru: ' (скрыто в интерфейсе)',
  th: ' (ซ่อนในหน้าจอ)',
  vi: ' (đã ẩn trên giao diện)',
  'zh-TW': '（介面上已隱藏）',
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
let changed = 0
for (const [loc, val] of Object.entries(T)) {
  const file = path.join(DIR, `${loc}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const re = new RegExp(`(['"])${KEY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`)
  if (re.test(src)) { console.log(`${loc}: 已有,跳过`); continue }
  const m = /\r?\n(\s*)biz:\s*\{\r?\n/.exec(src)
  if (!m) { console.log(`${loc}: ⚠ 找不到 biz 锚点`); continue }
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const at = m.index + m[0].length
  fs.writeFileSync(file, src.slice(0, at) + `    '${esc(KEY)}': '${esc(val)}',${nl}` + src.slice(at), 'utf8')
  console.log(`${loc}: 补 1 条`)
  changed++
}
console.log(`\n完成:${changed} 个语言包有改动`)
