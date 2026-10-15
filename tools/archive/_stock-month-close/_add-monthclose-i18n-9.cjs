/**
 * _add-monthclose-i18n-9.cjs — 第十五轮:二次展开(按批次号归组)的表头与提示词条(10 语言)
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-9.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = ['月结数量', '当月单据数', '当月合计', '余额', '无批次号', '首次月结']
const TEXT = {
  en: ['Close Qty', 'Docs This Month', 'Month Total', 'Balance', 'No batch no.', 'First Close'],
  ja: ['月次締め数量', '当月伝票数', '当月合計', '残高', '批次番号なし', '初回締め'],
  ko: ['월마감 수량', '당월 전표수', '당월 합계', '잔액', '배치번호 없음', '최초 마감'],
  'zh-TW': ['月結數量', '當月單據數', '當月合計', '餘額', '無批次號', '首次月結'],
  es: ['Cantidad de cierre', 'Documentos del mes', 'Total del mes', 'Saldo', 'Sin n.º de lote', 'Primer cierre'],
  fr: ['Quantité de clôture', 'Documents du mois', 'Total du mois', 'Solde', 'Sans n° de lot', 'Première clôture'],
  de: ['Abschlussmenge', 'Belege des Monats', 'Monatssumme', 'Saldo', 'Keine Chargennr.', 'Erster Abschluss'],
  ru: ['Кол-во закрытия', 'Документов за месяц', 'Итог месяца', 'Остаток', 'Без номера партии', 'Первое закрытие'],
  vi: ['SL kết chuyển', 'Số chứng từ tháng', 'Tổng tháng', 'Số dư', 'Không có số lô', 'Kết chuyển đầu'],
  th: ['จำนวนปิดบัญชี', 'จำนวนเอกสารเดือน', 'รวมเดือน', 'คงเหลือ', 'ไม่มีเลขล็อต', 'ปิดบัญชีครั้งแรก'],
}

let touched = 0
for (const [loc, texts] of Object.entries(TEXT)) {
  if (texts.length !== KEYS.length) throw new Error(`${loc} 词条数不一致`)
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const missing = KEYS.filter((k, i) => !lines.some((l) => l.includes(`'${k}':`)) && texts[i])
  if (!missing.length) { console.log(`[skip] ${loc}.js 已齐`); continue }
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  const added = KEYS.map((k, i) => (missing.includes(k) ? `${indent}'${k}': '${String(texts[i]).replace(/'/g, "\\'")}',` : null)).filter(Boolean)
  lines.splice(anchor + 1, 0, ...added)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
  console.log(`[ok] ${loc}.js +${added.length}`)
}
console.log(`完成:${touched}`)
