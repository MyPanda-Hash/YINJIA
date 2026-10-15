/**
 * _i18n-proc-cols.mjs — 给制程检验单新增纸张横表列相关 UI 词条(2026-10-17;同日第二轮加了"组名旁 ＋/－")。
 *
 * 用户口径:面板纸张表 = 图2 横表 + 外观组固定列(端盖两头/管身两侧)+ 表头「列数」字段与表格外 −/＋ 控件,
 * 且**表区组名旁另有「＋/－」**(只给本表区加/减一列检验项目)。
 * 新增的显示层文案必须走 tt(),并把译名落进 src/i18n/locales/*.js(AGENTS.md 多语言强制规范:
 * 至少 en,其余语言一并给)—— 本脚本把**缺失的**词条按语言插到「制程检验记录表」等锚点**之前**,
 * 幂等(逐条判存在,已存在的跳过)。用法:node tools/gen/_i18n-proc-cols.mjs
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
  // ---- 第二轮(同日):把"加列"放回**检验项目(表区组名)旁**,各表区各管各的 ----
  ['在本表区新增一个检验项目（加一列）', {
    en: 'Add an inspection item to this section (one more column)',
    ja: 'この表区に検査項目を追加(1列増やす)',
    ko: '이 구역에 검사 항목 추가(열 1개)',
    de: 'Prüfposition in diesem Bereich hinzufügen (eine Spalte)',
    es: 'Añadir un ítem de inspección a esta sección (una columna más)',
    fr: 'Ajouter un point de contrôle dans cette section (une colonne)',
    ru: 'Добавить пункт контроля в этот раздел (столбец)',
    th: 'เพิ่มรายการตรวจสอบในส่วนนี้ (เพิ่มหนึ่งคอลัมน์)',
    vi: 'Thêm hạng mục kiểm tra vào phần này (thêm một cột)',
    'zh-TW': '在本表區新增一個檢驗項目（加一列）',
  }],
  ['减少本表区最后一列（清空该列数据）', {
    en: 'Remove the last column of this section (clears its data)',
    ja: 'この表区の最後の列を減らす(この列のデータを消去)',
    ko: '이 구역의 마지막 열 줄이기(해당 열 데이터 삭제)',
    de: 'Letzte Spalte dieses Bereichs entfernen (Daten dieser Spalte löschen)',
    es: 'Quitar la última columna de esta sección (borra sus datos)',
    fr: 'Supprimer la dernière colonne de cette section (efface ses données)',
    ru: 'Убрать последний столбец этого раздела (данные будут очищены)',
    th: 'ลดคอลัมน์สุดท้ายของส่วนนี้ (ล้างข้อมูลในคอลัมน์นั้น)',
    vi: 'Bớt cột cuối của phần này (xóa dữ liệu cột đó)',
    'zh-TW': '減少本表區最後一列（清空該列數據）',
  }],
  ['本表区已经是最后一列', {
    en: 'This section already has only one column left',
    ja: 'この表区はすでに最後の1列です',
    ko: '이 구역은 이미 마지막 한 열입니다',
    de: 'Dieser Bereich hat bereits nur noch eine Spalte',
    es: 'Esta sección ya solo tiene una columna',
    fr: 'Cette section n\u2019a déjà plus qu\u2019une colonne',
    ru: 'В этом разделе уже остался один столбец',
    th: 'ส่วนนี้เหลือเพียงคอลัมน์เดียวแล้ว',
    vi: 'Phần này chỉ còn một cột',
    'zh-TW': '本表區已經是最後一列',
  }],
  ['每个表区先铺几列（不足的补空列；某表区已有更多检验项目时按实际铺）', {
    en: 'How many columns each section starts with (blank columns fill the gap; a section with more inspection items shows them all)',
    ja: '各表区が最初に敷く列数(不足分は空列で補充。検査項目が多い表区はその実数で表示)',
    ko: '각 구역에 기본으로 깔리는 열 수(부족하면 빈 열로 채우고, 검사 항목이 더 많은 구역은 실제 수대로 표시)',
    de: 'Wie viele Spalten jeder Bereich vorbelegt (fehlende als Leerspalten; Bereiche mit mehr Positionen zeigen alle)',
    es: 'Cuántas columnas se preparan por sección (las que falten se rellenan vacías; una sección con más ítems muestra todos)',
    fr: 'Nombre de colonnes prévues par section (les manquantes sont vides ; une section avec plus de points les affiche tous)',
    ru: 'Сколько столбцов заводится в каждом разделе (недостающие — пустые; раздел с большим числом пунктов показывает все)',
    th: 'จำนวนคอลัมน์เริ่มต้นของแต่ละส่วน (ส่วนที่ขาดจะเติมเป็นคอลัมน์ว่าง; ส่วนที่มีรายการมากกว่าจะแสดงตามจริง)',
    vi: 'Số cột mặc định của mỗi phần (thiếu thì thêm cột trống; phần có nhiều hạng mục hơn sẽ hiển thị đủ)',
    'zh-TW': '每個表區先鋪幾列（不足的補空列；某表區已有更多檢驗項目時按實際鋪）',
  }],
  ['本单最多 {n} 列', {
    en: 'This sheet has up to {n} column(s)',
    ja: '本伝票は最大 {n} 列',
    ko: '이 전표는 최대 {n}개 열',
    de: 'Dieser Beleg hat höchstens {n} Spalte(n)',
    es: 'Este documento tiene como máximo {n} columna(s)',
    fr: 'Ce document a au plus {n} colonne(s)',
    ru: 'В документе не более {n} столбц(ов)',
    th: 'เอกสารนี้มีไม่เกิน {n} คอลัมน์',
    vi: 'Phiếu này có tối đa {n} cột',
    'zh-TW': '本單最多 {n} 列',
  }],
  // ---- 第六轮(同日):纸面改**纵向表**(一行一个检验项目,照《生产相关品质检验.xlsx》第二块)----
  ['型号（mm）', {
    en: 'Model (mm)', ja: '型番（mm）', ko: '모델(mm)', de: 'Modell (mm)', es: 'Modelo (mm)',
    fr: 'Modèle (mm)', ru: 'Модель (мм)', th: 'รุ่น (มม.)', vi: 'Model (mm)', 'zh-TW': '型號（mm）',
  }],
  ['检验人员', {
    en: 'Inspector', ja: '検査担当者', ko: '검사원', de: 'Prüfer', es: 'Inspector',
    fr: 'Inspecteur', ru: 'Инспектор', th: 'ผู้ตรวจสอบ', vi: 'Nhân viên kiểm tra', 'zh-TW': '檢驗人員',
  }],
  ['产线常规功能性结果', {
    en: 'Line Routine Functional Result', ja: '生産ライン定常機能結果', ko: '라인 정규 기능 결과',
    de: 'Ergebnis der Routinetests', es: 'Resultado funcional de rutina', fr: 'Résultat fonctionnel de routine',
    ru: 'Результат штатного функционального теста', th: 'ผลทดสอบการทำงานตามปกติ', vi: 'Kết quả chức năng thường quy',
    'zh-TW': '產線常規功能性結果',
  }],
  ['结果判断', {
    en: 'Result Judgement', ja: '結果判定', ko: '결과 판정', de: 'Ergebnisbewertung', es: 'Juicio del resultado',
    fr: 'Jugement du résultat', ru: 'Заключение по результату', th: 'การตัดสินผล', vi: 'Kết luận kết quả',
    'zh-TW': '結果判斷',
  }],
  ['以下检验要求自动填充出货检验计划表', {
    en: 'The following requirements are auto-filled from the shipping inspection plan',
    ja: '以下の検査要求は出荷検査計画表から自動入力されます',
    ko: '아래 검사 요구사항은 출하 검사 계획표에서 자동으로 채워집니다',
    de: 'Die folgenden Prüfanforderungen werden aus dem Versandprüfplan automatisch gefüllt',
    es: 'Los siguientes requisitos se rellenan automáticamente del plan de inspección de envío',
    fr: 'Les exigences suivantes sont remplies automatiquement depuis le plan de contrôle d\u2019expédition',
    ru: 'Следующие требования заполняются автоматически из плана приёмочного контроля',
    th: 'ข้อกำหนดต่อไปนี้ถูกเติมอัตโนมัติจากแผนตรวจสอบก่อนส่ง',
    vi: 'Các yêu cầu sau được tự động điền từ kế hoạch kiểm tra xuất hàng',
    'zh-TW': '以下檢驗要求自動填充出貨檢驗計劃表',
  }],
  ['以下检验方法自动填充出货检验计划表', {
    en: 'The following methods are auto-filled from the shipping inspection plan',
    ja: '以下の検査方法は出荷検査計画表から自動入力されます',
    ko: '아래 검사 방법은 출하 검사 계획표에서 자동으로 채워집니다',
    de: 'Die folgenden Prüfmethoden werden aus dem Versandprüfplan automatisch gefüllt',
    es: 'Los siguientes métodos se rellenan automáticamente del plan de inspección de envío',
    fr: 'Les méthodes suivantes sont remplies automatiquement depuis le plan de contrôle d\u2019expédition',
    ru: 'Следующие методы заполняются автоматически из плана приёмочного контроля',
    th: 'วิธีการตรวจสอบต่อไปนี้ถูกเติมอัตโนมัติจากแผนตรวจสอบก่อนส่ง',
    vi: 'Các phương pháp sau được tự động điền từ kế hoạch kiểm tra xuất hàng',
    'zh-TW': '以下檢驗方法自動填充出貨檢驗計劃表',
  }],
  ['暂无检验项，点右上「⧉带入检验项目」或「＋新增检验项」开始', {
    en: 'No inspection item yet — use "⧉ Add from plan" or "＋ New item" at the top right',
    ja: '検査項目がありません。右上の「⧉ 検査項目を取り込む」または「＋ 項目追加」から始めてください',
    ko: '검사 항목이 없습니다. 오른쪽 위의 「⧉ 검사 항목 가져오기」또는 「＋ 항목 추가」로 시작하세요',
    de: 'Noch keine Prüfposition — oben rechts „⧉ Positionen übernehmen“ oder „＋ Neue Position“ nutzen',
    es: 'Aún no hay ítems — use «⧉ Añadir del plan» o «＋ Nuevo ítem» arriba a la derecha',
    fr: 'Aucun point de contrôle — utilisez « ⧉ Importer du plan » ou « ＋ Nouveau point » en haut à droite',
    ru: 'Пунктов контроля нет — используйте «⧉ Из плана» или «＋ Новый пункт» справа вверху',
    th: 'ยังไม่มีรายการตรวจสอบ ใช้ «⧉ นำเข้าจากแผน» หรือ «＋ เพิ่มรายการ» ที่มุมขวาบน',
    vi: 'Chưa có hạng mục kiểm tra — dùng «⧉ Lấy từ kế hoạch» hoặc «＋ Thêm hạng mục» ở góc trên bên phải',
    'zh-TW': '暫無檢驗項，點右上「⧉帶入檢驗項目」或「＋新增檢驗項」開始',
  }],
  ['删除本行将清空已填内容，确定删除吗？', {
    en: 'Deleting this line will clear what has been filled in. Delete it?',
    ja: 'この行を削除すると入力済みの内容が消去されます。削除しますか?',
    ko: '이 행을 삭제하면 입력한 내용이 지워집니다. 삭제하시겠습니까?',
    de: 'Beim Löschen dieser Zeile werden die Eingaben gelöscht. Zeile löschen?',
    es: 'Eliminar esta fila borrará lo introducido. ¿Eliminarla?',
    fr: 'Supprimer cette ligne effacera les données saisies. Confirmer ?',
    ru: 'При удалении строки введённые данные будут очищены. Удалить?',
    th: 'การลบแถวนี้จะล้างข้อมูลที่กรอกไว้ ยืนยันหรือไม่?',
    vi: 'Xóa dòng này sẽ xóa nội dung đã nhập. Xóa chứ?',
    'zh-TW': '刪除本行將清空已填內容,確定刪除嗎?',
  }],
  // ---- 第十一轮(同日):审批动作前的落库失败要**归因**(用户报障「未保存可以直接审核,出现错误」)----
  // 渲染示例:「审核前需先保存：请至少添加一行明细」/ en: "Save first before Approve: ..."。
  // {a} = 动作名(审核/提交审批/提交会签,经 tt() 翻译);冒号后半段是既有校验/后端报错原文。
  ['{a}前需先保存：', {
    en: 'Save first before {a}: ',
    ja: '{a}の前に保存が必要です:',
    ko: '{a} 전에 먼저 저장해야 합니다: ',
    de: 'Vor {a} zuerst speichern: ',
    es: 'Debe guardar antes de {a}: ',
    fr: 'Enregistrez d\u2019abord avant {a} : ',
    ru: 'Перед «{a}» нужно сохранить: ',
    th: 'ต้องบันทึกก่อน{a}: ',
    vi: 'Phải lưu trước khi {a}: ',
    'zh-TW': '{a}前需先保存：',
  }],
  // ---- 同批:审批情况弹窗里「弃审」行的结果列(后端 result 存的是 PENDING,直映会显示"审批中")----
  ['已弃审', {
    en: 'Unaudited', ja: '承認取消済み', ko: '승인 취소됨', de: 'Freigabe zurückgezogen',
    es: 'Aprobación retirada', fr: 'Approbation retirée', ru: 'Утверждение отозвано',
    th: 'ยกเลิกการอนุมัติแล้ว', vi: 'Đã hủy duyệt', 'zh-TW': '已棄審',
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
  // 逐条判存在:只补**缺失**的词条(第二轮追加时不重复插)
  const missing = ENTRIES.filter(([key]) => !lines.some((l) => l.includes(`${q(key)}:`)))
  if (!missing.length) { console.log(`SKIP ${loc}: 词条已齐`); continue }
  const at = ANCHORS.map((a) => lines.findIndex((l) => l.includes(a))).find((i) => i >= 0)
  if (at === undefined) { console.log(`SKIP ${loc}: 找不到锚点 ${ANCHORS.join(' / ')}`); continue }
  const block = ['    // ---- 制程检验单纸张横表:固定列 + 表头「列数」动态列 + 表区组名旁 ＋/－(2026-10-17)----']
  for (const [key, map] of missing) {
    const text = map[loc]
    if (!text) throw new Error(`缺 ${loc} 的译名: ${key}`)
    block.push(`    ${q(key)}: ${q(text)},`)
  }
  lines.splice(at, 0, ...block)
  fs.writeFileSync(file, lines.join('\r\n'), 'utf8')
  console.log(`OK ${loc}: +${missing.length} 条`)
  changed++
}
console.log(`完成:${changed} 个语言文件更新`)
