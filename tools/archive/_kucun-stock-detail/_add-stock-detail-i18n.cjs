/**
 * _add-stock-detail-i18n.cjs — 一次性脚本:给 10 个语言文件补「库存明细」及三张库存报表缺失的菜单词条
 *
 * 为什么:库存报表组新增第 4 项「库存明细」(STOCK_DETAIL),按多语言强制规范必须同时交付译名;
 *   顺手补上同组**一直缺译名**的「库存台账」「收发存汇总表」(此前只有「库存状况表」有 10 语言,
 *   切到 en/ja 时这两项仍显示中文)。
 * 做法:在既有 `'库存状况表': '…'` 那一行后面插入 4 条(已存在则跳过),保证同组词条挨在一起。
 * 用法:node tools/archive/_kucun-stock-detail/_add-stock-detail-i18n.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

/** 每个语言的四条菜单词条(与 STOCK_* 面板的 panel_name_en 口径保持一致) */
const TEXT = {
  en: { 库存明细: 'Stock Detail', 库存台账: 'Stock Ledger', 收发存汇总表: 'In-Out-Balance Summary' },
  ja: { 库存明细: '在庫明細', 库存台账: '在庫台帳', 收发存汇总表: '受払集計表' },
  ko: { 库存明细: '재고 명세', 库存台账: '재고 대장', 收发存汇总表: '수불 집계표' },
  'zh-TW': { 库存明细: '庫存明細', 库存台账: '庫存台賬', 收发存汇总表: '收發存匯總表' },
  es: { 库存明细: 'Detalle de Inventario', 库存台账: 'Mayor de Stock', 收发存汇总表: 'Resumen de Entradas y Salidas' },
  fr: { 库存明细: 'Détail du Stock', 库存台账: 'Grand Livre du Stock', 收发存汇总表: 'Récapitulatif Entrées-Sorties' },
  de: { 库存明细: 'Bestandsdetail', 库存台账: 'Lagerjournal', 收发存汇总表: 'Ein- und Ausgangsübersicht' },
  ru: { 库存明细: 'Детализация запасов', 库存台账: 'Складской регистр', 收发存汇总表: 'Сводка по приходу и расходу' },
  vi: { 库存明细: 'Chi tiết tồn kho', 库存台账: 'Sổ chi tiết kho', 收发存汇总表: 'Bảng tổng hợp nhập xuất tồn' },
  th: { 库存明细: 'รายละเอียดสต๊อก', 库存台账: 'บัญชีสต๊อก', 收发存汇总表: 'สรุปการรับ-จ่าย' },
}

let touched = 0
for (const [loc, dict] of Object.entries(TEXT)) {
  const file = path.join(localesDir, `${loc}.js`)
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  const missing = Object.keys(dict).filter((k) => !lines.some((l) => l.includes(`'${k}':`)))
  if (!missing.length) {
    console.log(`[skip] ${loc}.js 词条已齐`)
    continue
  }
  const anchor = lines.findIndex((l) => l.includes("'库存状况表':"))
  if (anchor < 0) throw new Error(`${loc}.js 找不到锚点行 '库存状况表'`)
  const indent = (lines[anchor].match(/^\s*/) || [''])[0]
  const added = Object.keys(dict)
    .filter((k) => missing.includes(k))
    .map((k) => `${indent}'${k}': '${dict[k].replace(/'/g, "\\'")}',`)
  lines.splice(anchor + 1, 0, ...added)
  fs.writeFileSync(file, lines.join('\n'), 'utf8')
  touched++
  console.log(`[ok] ${loc}.js 插入 ${added.length} 条:${missing.join('、')}`)
}
console.log(`完成:${touched}/${Object.keys(TEXT).length} 个语言文件被改写`)
