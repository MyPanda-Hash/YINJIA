/**
 * _i18n-insp-type-qty.mjs — 一次性脚本:把 2026-10-16「检验方案改检验类型 + 项目检验数量」
 * 涉及的新 UI 词条补进 frontend/src/i18n/locales 的 10 个静态语言包(至少 en,AGENTS 多语言规范)。
 *
 * 只管**静态包**;字段名(检验类型/检验数量/格数上限)另外由 tools/migrate-qc-plan-type-qty-20261016.sql
 * 写进 yj_translation(field scope)。已存在的键不动(幂等);插入点 = 各包 '检验内容' 那一行之前。
 *
 * 用法:node tools/archive/_i18n-insp-type-qty.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const LOCALES = join(HERE, '..', '..', 'frontend', 'src', 'i18n', 'locales')
const DRY = process.argv.includes('--dry')

/** 词条 → 各语言译文(zh-CN 是源语言,不入包) */
const DICT = {
  '检验类型': {
    en: 'Inspection Type', ja: '検査タイプ', ko: '검사 유형', de: 'Prüfart', fr: "Type d'inspection",
    es: 'Tipo de inspección', ru: 'Тип проверки', th: 'ประเภทการตรวจสอบ', vi: 'Loại kiểm tra', 'zh-TW': '檢驗類型',
  },
  '检验数量': {
    en: 'Inspection Qty', ja: '検査数量', ko: '검사 수량', de: 'Prüfmenge', fr: "Quantité d'inspection",
    es: 'Cantidad de inspección', ru: 'Количество проверок', th: 'จำนวนที่ตรวจสอบ', vi: 'Số lượng kiểm tra',
    'zh-TW': '檢驗數量',
  },
  '格数': {
    en: 'Cells', ja: 'マス数', ko: '칸 수', de: 'Zellen', fr: 'Cellules', es: 'Celdas',
    ru: 'Ячейки', th: 'จำนวนช่อง', vi: 'Số ô', 'zh-TW': '格數',
  },
  '检验类型 = 项目分类（如 外观检测/重量检测）：一个方案 = 一类项目，带入检验单后即横表的「表区」；检验数量决定带入后该项目的格数（列头 ＋ 加不过它）。': {
    en: 'Inspection Type = the item category (e.g. Appearance / Weight): one plan = one category, and it becomes the "section" of the grid on the inspection sheet; Inspection Qty sets how many cells the item gets after carrying in (the ＋ on the column header cannot go beyond it).',
    ja: '検査タイプ = 項目分類（例：外観検査／重量検査）。1つの方案 = 1つの分類で、検査票に取り込むと横表の「表区」になります。検査数量は取り込み後の格数になります（列見出しの＋はそれを超えられません）。',
    ko: '검사 유형 = 항목 분류(예: 외관 검사/중량 검사). 하나의 방안 = 하나의 분류로, 검사표에 반영하면 횡표의 「구역」이 됩니다. 검사 수량은 반영 후 해당 항목의 칸 수가 됩니다(열 머리의 ＋는 이를 넘을 수 없습니다).',
    de: 'Prüfart = die Positionskategorie (z. B. Aussehen / Gewicht): ein Plan = eine Kategorie und wird zur „Sektion" der Tabelle im Prüfschein; die Prüfmenge bestimmt die Zellenzahl der Position nach der Übernahme (das ＋ im Spaltenkopf kommt nicht darüber hinaus).',
    fr: "Type d'inspection = la catégorie de l'élément (ex. Aspect / Poids) : un plan = une catégorie, et il devient la « section » du tableau sur la fiche d'inspection ; la quantité d'inspection définit le nombre de cellules de cet élément après report (le ＋ de l'en-tête de colonne ne peut pas le dépasser).",
    es: 'Tipo de inspección = la categoría del elemento (p. ej. Aspecto / Peso): un plan = una categoría y pasa a ser la «sección» de la tabla en la hoja de inspección; la cantidad de inspección define cuántas celdas tiene el elemento tras el arrastre (el ＋ del encabezado de columna no puede superarlo).',
    ru: 'Тип проверки = категория пункта (например, внешний вид / вес): один план = одна категория, и она становится «разделом» таблицы в листе проверки; количество проверок задаёт число ячеек пункта после переноса (＋ в заголовке столбца не может его превысить).',
    th: 'ประเภทการตรวจสอบ = หมวดหมู่ของรายการ (เช่น การตรวจรูปลักษณ์ / การตรวจน้ำหนัก): หนึ่ง方案 = หนึ่งหมวดหมู่ และจะกลายเป็น «表区» ของตารางในใบตรวจสอบ จำนวนที่ตรวจสอบกำหนดจำนวนช่องของรายการนั้นหลังนำเข้า (ปุ่ม ＋ ที่หัวคอลัมน์เพิ่มเกินกว่านั้นไม่ได้)',
    vi: 'Loại kiểm tra = phân loại hạng mục (ví dụ Kiểm tra ngoại quan / Kiểm tra trọng lượng): một phương án = một phân loại và trở thành «khu vực» của bảng trên phiếu kiểm tra; số lượng kiểm tra quyết định số ô của hạng mục sau khi đưa vào (nút ＋ ở tiêu đề cột không vượt quá số đó).',
    'zh-TW': '檢驗類型 = 項目分類（如 外觀檢測/重量檢測）：一個方案 = 一類項目，帶入檢驗單後即橫表的「表區」；檢驗數量決定帶入後該項目的格數（列頭 ＋ 加不過它）。',
  },
  '如 外观检测 / 重量检测 / 尺寸检测（可直接输入新类型）': {
    en: 'e.g. Appearance / Weight / Dimension (type a new one directly)',
    ja: '例：外観検査／重量検査／寸法検査（新しい分類は直接入力）',
    ko: '예: 외관 검사/중량 검사/치수 검사(새 분류는 직접 입력)',
    de: 'z. B. Aussehen / Gewicht / Abmessung (neue Kategorie direkt eingeben)',
    fr: 'ex. Aspect / Poids / Dimension (saisissez une nouvelle catégorie)',
    es: 'p. ej. Aspecto / Peso / Dimensión (escriba una nueva categoría)',
    ru: 'напр. внешний вид / вес / размер (новую категорию можно ввести вручную)',
    th: 'เช่น การตรวจรูปลักษณ์ / การตรวจน้ำหนัก / การตรวจขนาด (พิมพ์หมวดใหม่ได้เลย)',
    vi: 'ví dụ Kiểm tra ngoại quan / trọng lượng / kích thước (nhập phân loại mới trực tiếp)',
    'zh-TW': '如 外觀檢測 / 重量檢測 / 尺寸檢測（可直接輸入新類型）',
  },
  '可留空；填 N = 带入后该项目的格数（列头 ＋ 加不过它）': {
    en: 'optional; N = cells of this item after carrying in (＋ cannot exceed it)',
    ja: '空欄可；N を入れると取り込み後の格数になります（列見出しの＋はそれを超えられません）',
    ko: '비워 둘 수 있음; N 입력 시 반영 후 칸 수가 됩니다(열 머리의 ＋는 이를 넘을 수 없습니다)',
    de: 'optional; N = Zellenzahl dieser Position nach der Übernahme (＋ kommt nicht darüber hinaus)',
    fr: 'facultatif ; N = nombre de cellules après report (le ＋ ne peut pas le dépasser)',
    es: 'opcional; N = celdas de este elemento tras el arrastre (el ＋ no puede superarlo)',
    ru: 'можно оставить пустым; N = число ячеек после переноса (＋ не может его превысить)',
    th: 'เว้นว่างได้; ใส่ N = จำนวนช่องหลังนำเข้า (ปุ่ม ＋ เพิ่มเกินกว่านั้นไม่ได้)',
    vi: 'có thể để trống; N = số ô sau khi đưa vào (nút ＋ không vượt quá)',
    'zh-TW': '可留空；填 N = 帶入後該項目的格數（列頭 ＋ 加不過它）',
  },
  '检验数量就这么几格，加不了了': {
    en: 'Inspection Qty is the limit — cannot add more cells',
    ja: '検査数量が上限です。これ以上は追加できません',
    ko: '검사 수량이 한계입니다. 더 이상 추가할 수 없습니다',
    de: 'Die Prüfmenge ist die Obergrenze – keine weiteren Zellen möglich',
    fr: "La quantité d'inspection est la limite — impossible d'ajouter des cellules",
    es: 'La cantidad de inspección es el límite: no se pueden añadir más celdas',
    ru: 'Количество проверок — это предел, больше ячеек добавить нельзя',
    th: 'จำนวนที่ตรวจสอบคือขีดจำกัด เพิ่มช่องไม่ได้แล้ว',
    vi: 'Số lượng kiểm tra là giới hạn — không thể thêm ô',
    'zh-TW': '檢驗數量就這麼幾格，加不了了',
  },
}

const LOCALES_LIST = ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']
/** JS 单引号字符串转义 */
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

let touched = 0
for (const loc of LOCALES_LIST) {
  const file = join(LOCALES, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  const lines = src.split(/\r?\n/)
  const anchor = lines.findIndex((l) => l.includes("'检验内容':"))
  if (anchor < 0) { console.log(`[SKIP] ${loc}: 未找到 '检验内容' 锚点`); continue }
  const add = []
  for (const [key, per] of Object.entries(DICT)) {
    if (!per[loc]) { console.log(`[WARN] ${loc} 缺 ${key} 的译文`); continue }
    if (src.includes(`${q(key)}:`)) continue      // 已有:不动
    add.push(`    ${q(key)}: ${q(per[loc])},`)
  }
  if (!add.length) { console.log(`[OK]   ${loc}: 无需补词条`); continue }
  lines.splice(anchor, 0, `    // ---- 检验类型/检验数量(2026-10-16 检验方案实现模式变更)----`, ...add)
  const out = lines.join(nl)
  if (DRY) console.log(`[DRY]  ${loc}: 将插入 ${add.length} 条`)
  else { writeFileSync(file, out, 'utf8'); console.log(`[OK]   ${loc}: 插入 ${add.length} 条`); touched++ }
}
console.log(DRY ? '（dry run,未写文件）' : `完成:写入 ${touched} 个语言包`)
