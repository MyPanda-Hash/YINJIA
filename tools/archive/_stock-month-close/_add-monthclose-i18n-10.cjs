/**
 * _add-monthclose-i18n-10.cjs — 第十六轮:库存预警相关词条(10 语言)
 *   · 预警数量已保存 / 保存预警数量失败 / 低于预警
 *   (「预警数量」标签本身已有全局译名 —— STOCK_STATUS 面板早就在用,这里只补新增的提示语。)
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-10.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = ['预警数量已保存', '保存预警数量失败', '低于预警']
const TEXT = {
  en: ['Warning quantity saved', 'Failed to save warning quantity', 'Below warning'],
  ja: ['警告数量を保存しました', '警告数量の保存に失敗しました', '警告値未満'],
  ko: ['경고 수량이 저장되었습니다', '경고 수량 저장 실패', '경고 미만'],
  'zh-TW': ['預警數量已儲存', '儲存預警數量失敗', '低於預警'],
  es: ['Cantidad de aviso guardada', 'No se pudo guardar la cantidad de aviso', 'Por debajo del aviso'],
  fr: ['Quantité d’alerte enregistrée', 'Échec de l’enregistrement de la quantité d’alerte', 'Sous le seuil d’alerte'],
  de: ['Warnmenge gespeichert', 'Warnmenge konnte nicht gespeichert werden', 'Unter Warnwert'],
  ru: ['Предупреждающее количество сохранено', 'Не удалось сохранить предупреждающее количество', 'Ниже предупреждения'],
  vi: ['Đã lưu số lượng cảnh báo', 'Lưu số lượng cảnh báo thất bại', 'Dưới ngưỡng cảnh báo'],
  th: ['บันทึกจำนวนแจ้งเตือนแล้ว', 'บันทึกจำนวนแจ้งเตือนไม่สำเร็จ', 'ต่ำกว่าเกณฑ์แจ้งเตือน'],
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
