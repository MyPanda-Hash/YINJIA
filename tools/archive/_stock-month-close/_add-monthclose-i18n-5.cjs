/**
 * _add-monthclose-i18n-5.cjs — 第七轮:左栏提示改为「勾选仓库即查询(单选);不勾选显示全部」(10 语言)
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-5.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEY = '勾选仓库即查询(单选);不勾选显示全部'
const TEXT = {
  en: 'Checking a warehouse queries immediately (single choice); nothing checked shows all',
  ja: '倉庫にチェックすると即検索(単一選択)。未チェックなら全件表示',
  ko: '창고를 선택하면 바로 조회(단일 선택). 선택하지 않으면 전체 표시',
  'zh-TW': '勾選倉庫即查詢(單選);不勾選顯示全部',
  es: 'Marcar un almacén consulta de inmediato (una sola opción); sin marcar se muestra todo',
  fr: 'Cocher un entrepôt lance la recherche (choix unique) ; sans coche, tout est affiché',
  de: 'Lager ankreuzen sucht sofort (Einzelauswahl); ohne Auswahl wird alles angezeigt',
  ru: 'Отметка склада сразу запускает поиск (один вариант); без выбора показываются все',
  vi: 'Tích chọn kho là truy vấn ngay (chọn một); không chọn thì hiển thị tất cả',
  th: 'ติ๊กเลือกคลังแล้วค้นหาทันที (เลือกได้หนึ่ง) ไม่เลือกจะแสดงทั้งหมด',
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
