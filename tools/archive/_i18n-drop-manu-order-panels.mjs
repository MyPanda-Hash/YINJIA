/**
 * _i18n-drop-manu-order-panels.mjs — 摘掉「生产工单明细表/统计表」这两条**已下架**的菜单译名(2026-10-17)。
 *
 * 面板与菜单项都下架了(migrate-drop-manu-order-report-panels-20261017.sql + menus.js),
 * 这两条 biz 词条已无任何调用点(全仓只剩语言包自己)⇒ 从 10 个语言包删掉,别让词典里留着
 * "看起来还有这么个菜单"的死条目。
 *
 * ⚠ 只删这两条**精确 key**;删前先断言现场只有它俩(每包恰好 2 条),有偏差就整体不动并报错。
 * ⚠ 语言包该段是**单引号**风格(en 是双引号),故按行匹配 `'键':` / `"键":` 两种写法。
 */
import fs from 'node:fs'

const KEYS = ['生产工单明细表', '生产工单统计表']
const LOCALES = ['zh-TW', 'en', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'vi', 'th']

let files = 0
let removed = 0
for (const loc of LOCALES) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  let n = 0
  for (const k of KEYS) {
    const re = new RegExp(`^[ \\t]*['"]${k}['"][ \\t]*:[^\\n]*\\r?\\n`, 'm')
    const m = s.match(re)
    if (m) { s = s.replace(re, ''); n++ }
  }
  if (n !== KEYS.length) {
    console.error(`✗ ${loc}: 只匹配到 ${n} 条(期望 ${KEYS.length})—— 本包不动,请人工核对`)
    continue
  }
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: -${n} 条`)
  files++
  removed += n
}
console.log(`\n共 ${files} 个语言包 / 删 ${removed} 条`)
