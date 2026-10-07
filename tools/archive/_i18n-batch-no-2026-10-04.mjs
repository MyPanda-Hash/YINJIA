/**
 * 一次性迁移(2026-10-04 批次号口径变更):替换 i18n 词条。
 *
 * 背景:批次号改为「生单那一刻按 供应商编码(去 YJ- 前缀)+ - + 当天 yyyyMMdd 取号」,
 * 前端不再有"按入库日期预设"这一说,BatchSendDialog 的提示文案随之改写;
 * 新增明细行批次号只读格的 tooltip 文案。
 *
 * 动作(每个 locale 文件):
 *   把旧的 '采购入库单填单时按入库日期预设,可修改': '…' 一行
 *   换成两条新词条 '生单时按供应商编码与当天日期生成' 与 '随单头批次号一致,不可修改'。
 *
 * 幂等:旧键不存在(已迁移过)则原样跳过;新键已存在也不重复插入。
 * 用法:node tools/archive/_i18n-batch-no-2026-10-04.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '..', '..', 'frontend', 'src', 'i18n', 'locales')

const OLD_KEY = '采购入库单填单时按入库日期预设,可修改'
const KEY_GEN = '生单时按供应商编码与当天日期生成'
const KEY_LOCK = '随单头批次号一致,不可修改'

/** locale → [生单取号文案, 明细只读文案] */
const TEXT = {
  en: ['Generated from the supplier code and the current date when the document is created',
       'Follows the header batch no.; not editable'],
  'zh-TW': ['生單時按供應商編碼與當天日期生成', '隨單頭批次號一致,不可修改'],
  ja: ['伝票生成時に仕入先コードと当日日付から生成', 'ヘッダーのロット番号に従い、変更不可'],
  ko: ['전표 생성 시 공급업체 코드와 당일 날짜로 생성', '헤더 배치 번호를 따르며 수정할 수 없습니다'],
  de: ['Beim Belegerstellen aus Lieferantencode und Tagesdatum erzeugt',
       'Folgt der Chargennummer des Kopfes; nicht änderbar'],
  fr: ['Généré depuis le code fournisseur et la date du jour à la création du document',
       "Identique au numéro de lot de l'en-tête ; non modifiable"],
  es: ['Se genera con el código de proveedor y la fecha del día al crear el documento',
       'Igual al n.º de lote de la cabecera; no editable'],
  ru: ['Формируется при создании документа из кода поставщика и текущей даты',
       'Совпадает с номером партии шапки; не редактируется'],
  vi: ['Được tạo từ mã nhà cung cấp và ngày hiện tại khi lập chứng từ',
       'Trùng số lô của phần đầu; không sửa được'],
  th: ['สร้างจากรหัสผู้ขายและวันที่ปัจจุบันเมื่อออกเอกสาร',
       'ตรงกับเลขล็อตของส่วนหัว แก้ไขไม่ได้'],
}

/** JS 单引号字符串字面量转义(含单引号的值改用双引号,见 q()) */
function q(s) {
  return s.includes("'") ? `"${s}"` : `'${s}'`
}

let changed = 0
for (const [locale, [genText, lockText]] of Object.entries(TEXT)) {
  const file = join(dir, `${locale}.js`)
  let src = readFileSync(file, 'utf8')
  if (!src.includes(`'${OLD_KEY}'`)) {
    console.log(`- ${locale}: 旧词条已不存在,跳过`)
    continue
  }
  const lines = src.split('\n')
  const out = []
  for (const line of lines) {
    if (!line.includes(`'${OLD_KEY}'`)) { out.push(line); continue }
    const indent = line.match(/^\s*/)[0]
    const comma = line.trimEnd().endsWith(',') ? ',' : ''
    out.push(`${indent}'${KEY_GEN}': ${q(genText)}${comma}`)
    out.push(`${indent}'${KEY_LOCK}': ${q(lockText)},`)
  }
  src = out.join('\n')
  writeFileSync(file, src, 'utf8')
  changed++
  console.log(`+ ${locale}: 已替换为 2 条新词条`)
}
console.log(`完成:${changed}/${Object.keys(TEXT).length} 个 locale 已更新`)
