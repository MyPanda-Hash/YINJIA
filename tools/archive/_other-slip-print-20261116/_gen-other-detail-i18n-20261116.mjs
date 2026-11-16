/**
 * _gen-other-detail-i18n-20261116.mjs — 明细页/查询区新词条写进 10 个语言包
 *
 * 用法(仓库根):node tools/archive/_other-slip-print-20261116/_gen-other-detail-i18n-20261116.mjs
 * 锚点:`'生产退料单': '<译名>',` 之后;幂等。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('frontend/src/i18n/locales')

const T = {
  输入单号或关键字查询: {
    en: 'Enter a document no. or keyword', 'zh-TW': '輸入單號或關鍵字查詢',
    ja: '伝票番号またはキーワードを入力', ko: '전표 번호 또는 키워드 입력',
    de: 'Belegnummer oder Suchwort eingeben', es: 'Introduzca número o palabra clave',
    fr: 'Saisissez un numéro ou un mot-clé', ru: 'Введите номер или ключевое слово',
    th: 'กรอกเลขที่เอกสารหรือคำค้น', vi: 'Nhập số phiếu hoặc từ khóa',
  },
  '点单据进明细页，在那里打印或补打印': {
    en: 'Tap a document to open its details — print or reprint there',
    'zh-TW': '點單據進明細頁，在那裡列印或補列印',
    ja: '伝票をタップして明細ページを開き、そこで印刷・再印刷します',
    ko: '전표를 눌러 상세 페이지로 들어간 뒤 그곳에서 인쇄/재출력하세요',
    de: 'Beleg antippen → Detailseite öffnen – dort drucken oder nachdrucken',
    es: 'Toque un documento para abrir el detalle: imprima o reimprima allí',
    fr: 'Touchez un bon pour ouvrir le détail : imprimez ou réimprimez à cet endroit',
    ru: 'Нажмите документ, чтобы открыть детали — там печать и повторная печать',
    th: 'แตะเอกสารเพื่อเปิดหน้ารายละเอียด แล้วพิมพ์หรือพิมพ์ซ้ำที่นั่น',
    vi: 'Chạm vào phiếu để mở chi tiết — in hoặc in lại tại đó',
  },
}

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const ANCHOR = /^\s*'生产退料单':\s*'.*',\s*$/m
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

let total = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  let text = fs.readFileSync(file, 'utf8')
  const lines = []
  for (const [key, map] of Object.entries(T)) {
    const val = map[loc]
    if (!val) throw new Error(`缺译名: ${loc} / ${key}`)
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`^\\s*['"]${esc}['"]\\s*:`, 'm').test(text)) continue
    lines.push(`    ${q(key)}: ${q(val)},`)
  }
  if (!lines.length) { console.log(`[skip] ${loc} 已齐`); continue }
  const m = text.match(ANCHOR)
  if (!m) throw new Error(`${loc}.js 找不到锚点行`)
  const at = m.index + m[0].length
  text = text.slice(0, at) + '\n' + lines.join('\n') + text.slice(at)
  fs.writeFileSync(file, text, 'utf8')
  total += lines.length
  console.log(`[ok] ${loc} +${lines.length}`)
}
console.log(`\n共写入 ${total} 条`)
