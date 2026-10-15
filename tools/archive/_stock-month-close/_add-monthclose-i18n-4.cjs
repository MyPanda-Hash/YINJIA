/**
 * _add-monthclose-i18n-4.cjs — 一次性脚本:补第五轮「勾选即查询/单选/不勾选为空」提示词条(10 语言)
 * 用法:node tools/archive/_stock-month-close/_add-monthclose-i18n-4.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const localesDir = path.resolve(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEY = '勾选仓库即查询;只能选一个;不勾选时列表为空'
const TEXT = {
  en: 'Checking a warehouse queries immediately; only one can be selected; nothing checked means an empty list',
  ja: '倉庫にチェックすると即検索します。選択は 1 つだけ。未チェックのときは一覧が空になります',
  ko: '창고를 선택하면 바로 조회됩니다. 하나만 선택할 수 있으며, 선택하지 않으면 목록이 비어 있습니다',
  'zh-TW': '勾選倉庫即查詢;只能選一個;不勾選時列表為空',
  es: 'Marcar un almacén consulta de inmediato; solo se puede elegir uno; sin marcar, la lista queda vacía',
  fr: 'Cocher un entrepôt lance la recherche ; un seul choix possible ; sans coche, la liste est vide',
  de: 'Lager ankreuzen sucht sofort; nur eines auswählbar; ohne Auswahl bleibt die Liste leer',
  ru: 'Отметка склада сразу запускает поиск; можно выбрать только один; без выбора список пуст',
  vi: 'Tích chọn kho là truy vấn ngay; chỉ chọn được một; không chọn thì danh sách trống',
  th: 'ติ๊กเลือกคลังแล้วค้นหาทันที เลือกได้เพียงหนึ่งแห่ง ถ้าไม่เลือกจะไม่มีข้อมูล',
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
  console.log(`[ok] ${loc}.js 插入 1 条`)
}
console.log(`完成:${touched}/${Object.keys(TEXT).length}`)
