/**
 * _add-monthclose-i18n-6.cjs — 第八轮:展开只留「该月原始单据」措辞(去掉"与当月")+ 标题措辞(10 语言)
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-6.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const ROWS = [
  ['上月月结已取消,以下陈列该月原始单据', {
    en: 'Last month close was cancelled; the original documents of that month are listed below',
    ja: '前月の月次締めは取消されました。以下に前月の元伝票を表示します',
    ko: '전월 마감이 취소되었습니다. 아래는 전월의 원본 전표입니다',
    'zh-TW': '上月月結已取消,以下陳列該月原始單據',
    es: 'El cierre del mes anterior fue cancelado; abajo se listan los documentos originales de ese mes',
    fr: 'La clôture du mois précédent a été annulée ; les documents d’origine de ce mois sont listés ci-dessous',
    de: 'Der Vormonatsabschluss wurde aufgehoben; unten stehen die Originalbelege jenes Monats',
    ru: 'Закрытие прошлого месяца отменено; ниже перечислены исходные документы того месяца',
    vi: 'Kết chuyển tháng trước đã bị hủy; dưới đây là chứng từ gốc của tháng đó',
    th: 'การปิดบัญชีเดือนก่อนถูกยกเลิก ด้านล่างคือเอกสารต้นฉบับของเดือนนั้น',
  }],
  ['上月未月结,以下陈列该月原始单据', {
    en: 'Last month is not closed; the original documents of that month are listed below',
    ja: '前月は未締めです。以下に前月の元伝票を表示します',
    ko: '전월이 미마감입니다. 아래는 전월의 원본 전표입니다',
    'zh-TW': '上月未月結,以下陳列該月原始單據',
    es: 'El mes anterior no está cerrado; abajo se listan los documentos originales de ese mes',
    fr: 'Le mois précédent n’est pas clôturé ; les documents d’origine de ce mois sont listés ci-dessous',
    de: 'Der Vormonat ist nicht abgeschlossen; unten stehen die Originalbelege jenes Monats',
    ru: 'Прошлый месяц не закрыт; ниже перечислены исходные документы того месяца',
    vi: 'Tháng trước chưa kết chuyển; dưới đây là chứng từ gốc của tháng đó',
    th: 'เดือนก่อนยังไม่ปิดบัญชี ด้านล่างคือเอกสารต้นฉบับของเดือนนั้น',
  }],
]

let touched = 0
for (const [loc] of Object.entries(ROWS[0][1])) {
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
