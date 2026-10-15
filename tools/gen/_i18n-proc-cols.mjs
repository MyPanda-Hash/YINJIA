/**
 * _i18n-proc-cols.mjs — 给制程检验单新增纸张横表列相关 UI 词条(2026-10-17)。
 *
 * 用户口径:面板纸张表 = 图2 横表 + 外观组固定列(端盖两头/管身两侧)+ 表头「列数」字段与表格外 −/＋ 控件。
 * 新增的显示层文案必须走 tt(),并把译名落进 src/i18n/locales/*.js(AGENTS.md 多语言强制规范:
 * 至少 en,其余语言一并给)—— 本脚本把同一批词条按语言插到各文件的「制程检验记录表」词条**之前**,
 * 幂等(已存在 '列数' 键就跳过)。用法:node tools/gen/_i18n-proc-cols.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales')
/** 插入锚点:各语言按顺序取第一个命中的(制程检验单/列数相关的既有词条,grep 实测 10 个语言都有) */
const ANCHORS = ["'制程检验记录表'", "'已是最大列数'", "'已是最少列数'", "'减少样品列'"]

/** [中文键, { locale: 译名 }] —— 只列本次新增的(已是最大列数/已是最少列数 等早有条目,不重复插) */
const ENTRIES = [
  ['列数', {
    en: 'Columns', ja: '列数', ko: '열 수', de: 'Spalten', es: 'Columnas', fr: 'Colonnes',
    ru: 'Столбцы', th: 'จำนวนคอลัมน์', vi: 'Số cột', 'zh-TW': '列數',
  }],
  ['增加一列', {
    en: 'Add a column', ja: '列を追加', ko: '열 추가', de: 'Spalte hinzufügen', es: 'Añadir columna',
    fr: 'Ajouter une colonne', ru: 'Добавить столбец', th: 'เพิ่มคอลัมน์', vi: 'Thêm cột', 'zh-TW': '增加一列',
  }],
  ['减少一列(清空该列已填数据)', {
    en: 'Remove a column (clears its data)', ja: '列を減らす(この列のデータを消去)', ko: '열 줄이기(해당 열 데이터 삭제)',
    de: 'Spalte entfernen (Daten dieser Spalte löschen)', es: 'Quitar columna (borra sus datos)',
    fr: 'Supprimer une colonne (efface ses données)', ru: 'Убрать столбец (данные столбца будут очищены)',
    th: 'ลดคอลัมน์ (ล้างข้อมูลในคอลัมน์นั้น)', vi: 'Bớt cột (xóa dữ liệu cột đó)', 'zh-TW': '減少一列(清空該列已填數據)',
  }],
  ['减少列将清空该列已填数据，确定减少吗？', {
    en: 'Reducing a column will clear the data filled in that column. Reduce it?',
    ja: '列を減らすと、その列の入力済みデータは消去されます。減らしますか?',
    ko: '열을 줄이면 해당 열에 입력된 데이터가 지워집니다. 줄이시겠습니까?',
    de: 'Beim Entfernen einer Spalte werden die eingetragenen Daten dieser Spalte gelöscht. Spalte entfernen?',
    es: 'Quitar una columna borrará los datos introducidos en ella. ¿Quitarla?',
    fr: 'Supprimer une colonne effacera les données saisies dans cette colonne. Confirmer ?',
    ru: 'При удалении столбца введённые в нём данные будут очищены. Продолжить?',
    th: 'การลดคอลัมน์จะล้างข้อมูลที่กรอกในคอลัมน์นั้น ยืนยันหรือไม่?',
    vi: 'Bớt cột sẽ xóa dữ liệu đã nhập trong cột đó. Tiếp tục?',
    'zh-TW': '減少列將清空該列已填數據,確定減少嗎?',
  }],
  ['减少列', {
    en: 'Reduce column', ja: '列を減らす', ko: '열 줄이기', de: 'Spalte entfernen', es: 'Quitar columna',
    fr: 'Supprimer une colonne', ru: 'Убрать столбец', th: 'ลดคอลัมน์', vi: 'Bớt cột', 'zh-TW': '減少列',
  }],
  ['按照{sec}检验项目填充', {
    en: 'Fill in per {sec} inspection items', ja: '{sec}の検査項目に従って記入', ko: '{sec} 검사 항목에 따라 기입',
    de: 'Gemäß {sec}-Prüfpositionen ausfüllen', es: 'Rellenar según los ítems de inspección de {sec}',
    fr: 'Remplir selon les points de contrôle {sec}', ru: 'Заполнить по пунктам контроля «{sec}»',
    th: 'กรอกตามรายการตรวจสอบ {sec}', vi: 'Điền theo hạng mục kiểm tra {sec}', 'zh-TW': '按照{sec}檢驗項目填充',
  }],
  ['固定列（不可删）', {
    en: 'Fixed column (cannot be deleted)', ja: '固定列(削除不可)', ko: '고정 열(삭제 불가)',
    de: 'Feste Spalte (nicht löschbar)', es: 'Columna fija (no se puede eliminar)',
    fr: 'Colonne fixe (non supprimable)', ru: 'Фиксированный столбец (нельзя удалить)',
    th: 'คอลัมน์คงที่ (ลบไม่ได้)', vi: 'Cột cố định (không xóa được)', 'zh-TW': '固定列(不可刪)',
  }],
  ['先填列头项目名', {
    en: 'Fill the item name in the column header first', ja: '先に列見出しの項目名を入力してください',
    ko: '먼저 열 머리의 항목명을 입력하세요', de: 'Zuerst den Positionsnamen in der Spaltenüberschrift eintragen',
    es: 'Primero escriba el nombre del ítem en el encabezado',
    fr: 'Saisissez d\u2019abord le nom du point dans l\u2019en-tête',
    ru: 'Сначала укажите название пункта в заголовке столбца', th: 'กรอกชื่อรายการที่หัวคอลัมน์ก่อน',
    vi: 'Nhập tên hạng mục ở tiêu đề cột trước', 'zh-TW': '先填列頭項目名',
  }],
  ['有 {n} 行还没归类（表区为空），请在明细列表里补表区', {
    en: '{n} row(s) have no section yet — please fill in the section in the detail list',
    ja: '未分類の行が {n} 行あります(表区が空)。明細一覧で表区を入力してください',
    ko: '분류되지 않은 행이 {n}개 있습니다(표구가 비어 있음). 상세 목록에서 표구를 입력하세요',
    de: '{n} Zeile(n) ohne Bereich — bitte den Bereich in der Detailliste ergänzen',
    es: '{n} fila(s) sin sección: complete la sección en la lista de detalles',
    fr: '{n} ligne(s) sans section — complétez la section dans la liste de détail',
    ru: 'Строк без раздела: {n} — укажите раздел в списке строк',
    th: 'มี {n} แถวที่ยังไม่จัดกลุ่ม (ส่วนว่าง) กรุณากรอกส่วนในรายการรายละเอียด',
    vi: 'Có {n} dòng chưa phân nhóm (phần trống), vui lòng bổ sung phần trong danh sách chi tiết',
    'zh-TW': '有 {n} 行還沒歸類(表區為空),請在明細列表裡補表區',
  }],
  ['本单已有 {n} 列（按存量数据），点 － 可减列并清空该列数据', {
    en: 'This sheet already has {n} column(s) (from existing data); click − to reduce a column and clear its data',
    ja: '本伝票は既に {n} 列あります(既存データ)。− で列を減らすとその列のデータは消去されます',
    ko: '이 전표에는 이미 {n}개 열이 있습니다(기존 데이터). − 를 누르면 열을 줄이고 데이터를 지웁니다',
    de: 'Dieser Beleg hat bereits {n} Spalte(n) (aus Bestandsdaten); mit − reduzieren und Daten löschen',
    es: 'Este documento ya tiene {n} columna(s) (según datos existentes); pulse − para reducir y borrar sus datos',
    fr: 'Ce document a déjà {n} colonne(s) (données existantes) ; cliquez sur − pour réduire et effacer ses données',
    ru: 'В документе уже {n} столбц(ов) (по имеющимся данным); нажмите −, чтобы убрать столбец и очистить данные',
    th: 'เอกสารนี้มี {n} คอลัมน์แล้ว (ตามข้อมูลเดิม) กด − เพื่อลดคอลัมน์และล้างข้อมูล',
    vi: 'Phiếu này đã có {n} cột (theo dữ liệu hiện có); nhấn − để bớt cột và xóa dữ liệu',
    'zh-TW': '本單已有 {n} 列(按存量數據),點 － 可減列並清空該列數據',
  }],
]

const LOCALES = ['en', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi', 'zh-TW']
/** JS 单引号字符串转义(词条里可能出现 ' 与 \) */
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

let changed = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  if (!fs.existsSync(file)) { console.log(`SKIP ${loc}: 文件不存在`); continue }
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
  if (lines.some((l) => l.includes("'列数':"))) { console.log(`SKIP ${loc}: 词条已在`); continue }
  const at = ANCHORS.map((a) => lines.findIndex((l) => l.includes(a))).find((i) => i >= 0)
  if (at === undefined) { console.log(`SKIP ${loc}: 找不到锚点 ${ANCHORS.join(' / ')}`); continue }
  const block = [`    // ---- 制程检验单纸张横表:固定列 + 表头「列数」动态列(2026-10-17)----`]
  for (const [key, map] of ENTRIES) {
    const text = map[loc]
    if (!text) throw new Error(`缺 ${loc} 的译名: ${key}`)
    block.push(`    ${q(key)}: ${q(text)},`)
  }
  lines.splice(at, 0, ...block)
  fs.writeFileSync(file, lines.join('\r\n'), 'utf8')
  console.log(`OK ${loc}: +${ENTRIES.length} 条`)
  changed++
}
console.log(`完成:${changed} 个语言文件更新`)
