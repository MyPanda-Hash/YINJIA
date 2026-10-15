/**
 * _add-monthclose-i18n-7.cjs — 第八轮补:空展开区的两句提示(10 语言)
 *   · 上月期末结存为 0,无结转行
 *   · 上月无出入库单据
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-7.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const ROWS = [
  ['上月期末结存为 0,无结转行', {
    en: 'Closing balance of last month was 0, so there is no carry-forward row',
    ja: '前月の期末残高が 0 のため、繰越行はありません',
    ko: '전월 기말 잔액이 0이므로 이월 행이 없습니다',
    'zh-TW': '上月期末結存為 0,無結轉行',
    es: 'El saldo final del mes anterior fue 0, no hay línea de arrastre',
    fr: 'Le solde final du mois précédent était 0 : aucune ligne de report',
    de: 'Der Endbestand des Vormonats war 0, daher keine Übertragszeile',
    ru: 'Конечный остаток прошлого месяца равен 0 — строки переноса нет',
    vi: 'Tồn cuối kỳ tháng trước bằng 0, không có dòng kết chuyển',
    th: 'ยอดคงเหลือปลายงวดเดือนก่อนเป็น 0 จึงไม่มีรายการยกยอด',
  }],
  ['上月无出入库单据', {
    en: 'No inbound/outbound documents last month',
    ja: '前月の入出庫伝票はありません',
    ko: '전월 입출고 전표가 없습니다',
    'zh-TW': '上月無出入庫單據',
    es: 'No hay documentos de entrada/salida el mes anterior',
    fr: 'Aucun document d’entrée/sortie le mois précédent',
    de: 'Im Vormonat keine Zu-/Abgangsbelege',
    ru: 'За прошлый месяц документов прихода/расхода нет',
    vi: 'Tháng trước không có chứng từ nhập/xuất',
    th: 'เดือนก่อนไม่มีเอกสารรับเข้า/จ่ายออก',
  }],
]

let touched = 0
for (const loc of Object.keys(ROWS[0][1])) {
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  let added = 0
  for (const [key, text] of ROWS) {
    if (lines.some((l) => l.includes(`'${key}':`))) continue
    lines.splice(anchor + 1, 0, `${indent}'${key}': '${String(text[loc]).replace(/'/g, "\\'")}',`)
    added++
  }
  if (added) { fs.writeFileSync(file, lines.join('\n'), 'utf8'); touched++ }
}
console.log(`完成:${touched}/${Object.keys(ROWS[0][1]).length}`)
