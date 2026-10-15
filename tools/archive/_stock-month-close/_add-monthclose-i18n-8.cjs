/**
 * _add-monthclose-i18n-8.cjs — 第十二轮:期初来源说明「月末结转」词条(10 语言)
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-8.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEY = '月末结转'
const TEXT = {
  en: ' month-end carry-forward',
  ja: ' 月末繰越',
  ko: ' 월말 이월',
  'zh-TW': '月末結轉',
  es: ' arrastre de fin de mes',
  fr: ' report de fin de mois',
  de: ' Monatsendübertrag',
  ru: ' перенос на конец месяца',
  vi: ' kết chuyển cuối tháng',
  th: ' ยกยอดสิ้นเดือน',
}

let touched = 0
for (const [loc, text] of Object.entries(TEXT)) {
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  if (lines.some((l) => l.includes(`'${KEY}':`))) { console.log(`[skip] ${loc}.js 已有`); continue }
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  lines.splice(anchor + 1, 0, `${indent}'${KEY}': '${text.replace(/'/g, "\\'")}',`)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
}
console.log(`完成:${touched}/${Object.keys(TEXT).length}`)
