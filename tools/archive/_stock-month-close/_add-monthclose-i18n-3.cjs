/**
 * _add-monthclose-i18n-3.cjs — 一次性脚本:补第三轮「取消月结后陈列该月单据」相关词条(10 语言)
 * 新增中文原文:月份 / 月结状态 / 上月月结已取消,以下陈列该月与当月的原始单据 / 上月未月结,以下陈列该月与当月的原始单据
 * 幂等:已存在的键自动跳过;插在既有 '库存明细': 词条之后。
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-3.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = ['月份', '月结状态', '上月月结已取消,以下陈列该月与当月的原始单据', '上月未月结,以下陈列该月与当月的原始单据']
const TEXT = {
  en: ['Month', 'Close Status', 'Last month close was cancelled; the original documents of that month and the current month are listed below', 'Last month is not closed; the original documents of that month and the current month are listed below'],
  ja: ['月', '月次締め状態', '前月の月次締めは取消されました。以下に前月と当月の元伝票を表示します', '前月は未締めです。以下に前月と当月の元伝票を表示します'],
  ko: ['월', '마감 상태', '전월 마감이 취소되었습니다. 아래는 전월과 당월의 원본 전표입니다', '전월이 미마감입니다. 아래는 전월과 당월의 원본 전표입니다'],
  'zh-TW': ['月份', '月結狀態', '上月月結已取消,以下陳列該月與當月的原始單據', '上月未月結,以下陳列該月與當月的原始單據'],
  es: ['Mes', 'Estado del cierre', 'El cierre del mes anterior fue cancelado; abajo se listan los documentos originales de ese mes y del mes actual', 'El mes anterior no está cerrado; abajo se listan los documentos originales de ese mes y del mes actual'],
  fr: ['Mois', 'État de la clôture', 'La clôture du mois précédent a été annulée ; les documents d’origine de ce mois et du mois courant sont listés ci-dessous', 'Le mois précédent n’est pas clôturé ; les documents d’origine de ce mois et du mois courant sont listés ci-dessous'],
  de: ['Monat', 'Abschlussstatus', 'Der Vormonatsabschluss wurde aufgehoben; unten stehen die Originalbelege jenes Monats und des aktuellen Monats', 'Der Vormonat ist nicht abgeschlossen; unten stehen die Originalbelege jenes Monats und des aktuellen Monats'],
  ru: ['Месяц', 'Статус закрытия', 'Закрытие прошлого месяца отменено; ниже перечислены исходные документы того и текущего месяца', 'Прошлый месяц не закрыт; ниже перечислены исходные документы того и текущего месяца'],
  vi: ['Tháng', 'Trạng thái kết chuyển', 'Kết chuyển tháng trước đã bị hủy; dưới đây là chứng từ gốc của tháng đó và tháng hiện tại', 'Tháng trước chưa kết chuyển; dưới đây là chứng từ gốc của tháng đó và tháng hiện tại'],
  th: ['เดือน', 'สถานะปิดบัญชี', 'การปิดบัญชีเดือนก่อนถูกยกเลิก ด้านล่างคือเอกสารต้นฉบับของเดือนนั้นและเดือนปัจจุบัน', 'เดือนก่อนยังไม่ปิดบัญชี ด้านล่างคือเอกสารต้นฉบับของเดือนนั้นและเดือนปัจจุบัน'],
}

let touched = 0
for (const [loc, texts] of Object.entries(TEXT)) {
  if (texts.length !== KEYS.length) throw new Error(`${loc} 词条数不一致`)
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const missing = KEYS.filter((k, i) => texts[i] && !lines.some((l) => l.includes(`'${k}':`)))
  if (!missing.length) { console.log(`[skip] ${loc}.js 已齐`); continue }
  const anchor = lines.findIndex((l) => l.includes("'库存明细':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  const added = KEYS.map((k, i) => (missing.includes(k) ? `${indent}'${k}': '${String(texts[i]).replace(/'/g, "\\'")}',` : null)).filter(Boolean)
  lines.splice(anchor + 1, 0, ...added)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
  console.log(`[ok] ${loc}.js 插入 ${added.length} 条`)
}
console.log(`完成:${touched}/${Object.keys(TEXT).length}`)
