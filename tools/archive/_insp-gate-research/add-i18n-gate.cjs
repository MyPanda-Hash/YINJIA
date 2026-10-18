/**
 * add-i18n-gate.cjs —— 把「成型完成门禁」新增的前端文案补进各语言包(2026-10-19)。
 *
 * 为什么要脚本而不是手改:10 个语言包 × 11 条词条 = 110 处,手改必漂移;
 * 且要幂等(重复执行不重复插)、要能核对条数。
 *
 * 插入点:每个语言包里 `"生成制程检验单失败"` 那一行之后(首件/制程检验单那组词条的末尾)。
 * 执行(在仓库根):node tools/archive/_insp-gate-research/add-i18n-gate.cjs
 */
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'src', 'i18n', 'locales')

const KEYS = [
  ['只有完成成型报工的工单行才能生成检验单；置灰的行会写明原因。', {
    en: 'Only work-order lines whose molding operation has been reported can create an inspection sheet; greyed lines state the reason.',
    ja: '成形工程の報告が完了した製造指図行のみ検査表を作成できます。グレーの行には理由が表示されます。',
    ko: '성형 공정 보고가 완료된 작업지시 행만 검사표를 생성할 수 있습니다. 회색 행에는 사유가 표시됩니다.',
    'zh-TW': '只有完成成型報工的工單行才能生成檢驗單；置灰的行會寫明原因。',
    de: 'Nur Auftragszeilen mit gemeldeter Formgebung können ein Prüfblatt erstellen; ausgegraute Zeilen nennen den Grund.',
    fr: "Seules les lignes d'ordre dont l'opération de moulage est déclarée peuvent créer une fiche de contrôle ; les lignes grisées indiquent la raison.",
    es: 'Solo las líneas de orden cuya operación de moldeo esté reportada pueden crear la hoja de inspección; las líneas en gris indican el motivo.',
    ru: 'Создать лист контроля можно только для строк заказа с отчётом по формованию; у серых строк указана причина.',
    vi: 'Chỉ dòng lệnh đã báo cáo công đoạn tạo hình mới tạo được phiếu kiểm tra; dòng bị làm mờ sẽ ghi rõ lý do.',
    th: 'เฉพาะบรรทัดใบสั่งที่รายงานขั้นตอนขึ้นรูปแล้วเท่านั้นจึงสร้างใบตรวจสอบได้ บรรทัดที่จางจะระบุเหตุผล',
  }],
  ['成型完工量', {
    en: 'Molding completed qty', ja: '成形完了量', ko: '성형 완료량', 'zh-TW': '成型完工量',
    de: 'Formgebung fertig', fr: 'Quantité moulée', es: 'Cantidad de moldeo completada',
    ru: 'Объём формования выполнен', vi: 'SL tạo hình hoàn thành', th: 'ปริมาณขึ้นรูปเสร็จ',
  }],
  ['成型计划量', {
    en: 'Molding planned qty', ja: '成形計画量', ko: '성형 계획량', 'zh-TW': '成型計劃量',
    de: 'Formgebung geplant', fr: 'Quantité planifiée', es: 'Cantidad de moldeo planificada',
    ru: 'План формования', vi: 'SL tạo hình kế hoạch', th: 'ปริมาณขึ้นรูปตามแผน',
  }],
  ['可开单', {
    en: 'Can create', ja: '起票可', ko: '전표 생성 가능', 'zh-TW': '可開單',
    de: 'Beleg möglich', fr: 'Créable', es: 'Se puede crear', ru: 'Можно создать',
    vi: 'Có thể tạo', th: 'สร้างได้',
  }],
  ['免门禁', {
    en: 'No gate', ja: 'ゲート対象外', ko: '게이트 제외', 'zh-TW': '免門禁',
    de: 'Keine Sperre', fr: 'Sans contrôle', es: 'Sin restricción', ru: 'Без ограничения',
    vi: 'Miễn kiểm soát', th: 'ไม่มีข้อจำกัด',
  }],
  ['存量放行', {
    en: 'Legacy pass', ja: '既存データで許可', ko: '기존 데이터 허용', 'zh-TW': '存量放行',
    de: 'Altbestand erlaubt', fr: 'Données existantes', es: 'Datos existentes',
    ru: 'Старые данные', vi: 'Dữ liệu cũ', th: 'ข้อมูลเดิม',
  }],
  ['成型未报工', {
    en: 'Molding not reported', ja: '成形未報告', ko: '성형 미보고', 'zh-TW': '成型未報工',
    de: 'Formgebung nicht gemeldet', fr: 'Moulage non déclaré', es: 'Moldeo sin reportar',
    ru: 'Формование не отчитано', vi: 'Chưa báo cáo tạo hình', th: 'ยังไม่รายงานขึ้นรูป',
  }],
  ['该工单行暂不能生成检验单', {
    en: 'This work-order line cannot create an inspection sheet yet',
    ja: 'この製造指図行では検査表を作成できません',
    ko: '이 작업지시 행은 아직 검사표를 생성할 수 없습니다',
    'zh-TW': '該工單行暫不能生成檢驗單',
    de: 'Für diese Auftragszeile kann noch kein Prüfblatt erstellt werden',
    fr: "Cette ligne d'ordre ne peut pas encore créer de fiche de contrôle",
    es: 'Esta línea de orden aún no puede crear una hoja de inspección',
    ru: 'Для этой строки заказа пока нельзя создать лист контроля',
    vi: 'Dòng lệnh này hiện chưa thể tạo phiếu kiểm tra',
    th: 'บรรทัดใบสั่งนี้ยังสร้างใบตรวจสอบไม่ได้',
  }],
  ['该生产工单行的成型工序尚未报工（成型完工量 0），暂不能生成检验单', {
    en: 'The molding operation of this work-order line has not been reported yet (molding completed qty 0), so no inspection sheet can be created for now',
    ja: 'この製造指図行の成形工程はまだ報告されていません（成形完了量 0）。現時点では検査表を作成できません',
    ko: '이 작업지시 행의 성형 공정이 아직 보고되지 않았습니다(성형 완료량 0). 현재는 검사표를 생성할 수 없습니다',
    'zh-TW': '該生產工單行的成型工序尚未報工（成型完工量 0），暫不能生成檢驗單',
    de: 'Der Formgebungsvorgang dieser Auftragszeile wurde noch nicht gemeldet (fertige Menge 0); derzeit kann kein Prüfblatt erstellt werden',
    fr: "L'opération de moulage de cette ligne d'ordre n'est pas encore déclarée (quantité moulée 0) ; la fiche ne peut pas être créée pour l'instant",
    es: 'La operación de moldeo de esta línea de orden aún no se ha reportado (cantidad completada 0); por ahora no se puede crear la hoja',
    ru: 'По операции формования этой строки заказа ещё нет отчёта (выполнено 0); сейчас лист контроля создать нельзя',
    vi: 'Công đoạn tạo hình của dòng lệnh này chưa được báo cáo (số lượng hoàn thành 0), hiện chưa thể tạo phiếu kiểm tra',
    th: 'ขั้นตอนขึ้นรูปของบรรทัดใบสั่งนี้ยังไม่ถูกรายงาน (ปริมาณเสร็จ 0) จึงยังสร้างใบตรวจสอบไม่ได้',
  }],
  ['该工单未绑工艺路线或路线里没有「成型」工序，本单免门禁', {
    en: 'This work order has no routing, or the routing has no "Molding" operation; the gate does not apply',
    ja: 'この製造指図に工程表がない、または工程表に「成形」がありません。本ゲートは適用外です',
    ko: "이 작업지시에 공정 경로가 없거나 경로에 '성형' 공정이 없습니다. 본 게이트는 적용되지 않습니다",
    'zh-TW': '該工單未綁工藝路線或路線裡沒有「成型」工序，本單免門禁',
    de: 'Dieser Auftrag hat keinen Arbeitsplan oder der Plan enthält keinen Vorgang „Formgebung“; die Sperre gilt nicht',
    fr: "Cet ordre n'a pas de gamme, ou la gamme ne contient pas l'opération « Moulage » ; le contrôle ne s'applique pas",
    es: 'Esta orden no tiene ruta, o la ruta no incluye la operación «Moldeo»; la restricción no aplica',
    ru: 'У заказа нет маршрута или в маршруте нет операции «Формование»; ограничение не применяется',
    vi: 'Lệnh này chưa gắn quy trình công nghệ hoặc quy trình không có công đoạn «Tạo hình»; không áp dụng kiểm soát',
    th: 'ใบสั่งนี้ไม่ได้ผูกเส้นทางกระบวนการ หรือเส้นทางไม่มีขั้นตอน «ขึ้นรูป» จึงไม่ใช้ข้อจำกัดนี้',
  }],
  ['该生产工单行还没有任何已审核报工（存量数据），按现状放行', {
    en: 'This work-order line has no audited work report yet (legacy data) and is let through as-is',
    ja: 'この製造指図行にはまだ承認済みの作業報告がありません（既存データ）。現状のまま通します',
    ko: '이 작업지시 행에는 아직 승인된 작업 보고가 없습니다(기존 데이터). 현 상태로 통과시킵니다',
    'zh-TW': '該生產工單行還沒有任何已審核報工（存量數據），按現狀放行',
    de: 'Für diese Auftragszeile gibt es noch keine freigegebene Rückmeldung (Altbestand); sie wird unverändert durchgelassen',
    fr: "Cette ligne d'ordre n'a encore aucune déclaration approuvée (données existantes) ; elle est laissée passer en l'état",
    es: 'Esta línea de orden aún no tiene ningún reporte de trabajo aprobado (datos existentes); se deja pasar tal cual',
    ru: 'По этой строке заказа ещё нет утверждённых отчётов (старые данные); пропускаем как есть',
    vi: 'Dòng lệnh này chưa có báo cáo công việc nào được duyệt (dữ liệu cũ), tạm cho qua',
    th: 'บรรทัดใบสั่งนี้ยังไม่มีการรายงานที่อนุมัติแล้ว (ข้อมูลเดิม) จึงปล่อยผ่านตามเดิม',
  }],
  // ── 2026-10-16 追加:强度开关(warn 档)+ 管理员强制开单(WoInspGateGuard)──
  ['预警放行', {
    en: 'Warn & allow', ja: '警告のうえ許可', ko: '경고 후 허용', 'zh-TW': '預警放行',
    de: 'Warnen, zulassen', fr: 'Avertir et autoriser', es: 'Avisar y permitir',
    ru: 'Предупредить и разрешить', vi: 'Cảnh báo và cho qua', th: 'เตือนแต่ปล่อยผ่าน',
  }],
  ['强制开单', {
    en: 'Force create', ja: '強制起票', ko: '강제 생성', 'zh-TW': '強制開單',
    de: 'Erstellung erzwingen', fr: 'Forcer la création', es: 'Forzar creación',
    ru: 'Создать принудительно', vi: 'Buộc tạo', th: 'บังคับสร้าง',
  }],
  ['强制开单原因', {
    en: 'Reason for forcing', ja: '強制起票の理由', ko: '강제 생성 사유', 'zh-TW': '強制開單原因',
    de: 'Grund für die erzwungene Erstellung', fr: 'Motif du forçage',
    es: 'Motivo de la creación forzada', ru: 'Причина принудительного создания',
    vi: 'Lý do buộc tạo', th: 'เหตุผลที่บังคับสร้าง',
  }],
  ['请填写强制开单原因', {
    en: 'Please enter the reason for forcing', ja: '強制起票の理由を入力してください',
    ko: '강제 생성 사유를 입력하세요', 'zh-TW': '請填寫強制開單原因',
    de: 'Bitte den Grund für die erzwungene Erstellung angeben',
    fr: 'Veuillez saisir le motif du forçage', es: 'Introduzca el motivo de la creación forzada',
    ru: 'Укажите причину принудительного создания', vi: 'Vui lòng nhập lý do buộc tạo',
    th: 'กรุณาระบุเหตุผลที่บังคับสร้าง',
  }],
  ['该工单行的成型工序尚未报工，确认仍要生成检验单吗？', {
    en: 'The molding operation of this work-order line has not been reported. Create the inspection sheet anyway?',
    ja: 'この製造指図行の成形工程はまだ報告されていません。それでも検査表を作成しますか？',
    ko: '이 작업지시 행의 성형 공정이 아직 보고되지 않았습니다. 그래도 검사표를 생성하시겠습니까?',
    'zh-TW': '該工單行的成型工序尚未報工，確認仍要生成檢驗單嗎？',
    de: 'Der Formgebungsvorgang dieser Auftragszeile wurde noch nicht gemeldet. Prüfblatt trotzdem erstellen?',
    fr: "L'opération de moulage de cette ligne d'ordre n'est pas déclarée. Créer la fiche quand même ?",
    es: 'La operación de moldeo de esta línea aún no se ha reportado. ¿Crear la hoja de todos modos?',
    ru: 'По операции формования этой строки заказа ещё нет отчёта. Всё равно создать лист?',
    vi: 'Công đoạn tạo hình của dòng lệnh này chưa được báo cáo. Vẫn tạo phiếu kiểm tra?',
    th: 'ขั้นตอนขึ้นรูปของบรรทัดใบสั่งนี้ยังไม่ถูกรายงาน ยังต้องการสร้างใบตรวจสอบหรือไม่?',
  }],
]

const LOCALES = ['en', 'ja', 'ko', 'zh-TW', 'de', 'fr', 'es', 'ru', 'vi', 'th']
const ANCHOR = '"生成制程检验单失败"'

let changed = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  const raw = fs.readFileSync(file, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  // 幂等按**逐条**判:已存在的词条不重复插(第二轮追加词条时也要能补进已有语言包)
  const missing = KEYS.filter(([zh]) => !raw.includes(JSON.stringify(zh) + ':'))
  if (!missing.length) { console.log(`[skip] ${loc} 词条已齐全`); continue }
  const lines = raw.split(/\r?\n/)
  let at = lines.findIndex((l) => l.includes(ANCHOR))
  if (at < 0) { console.log(`[FAIL] ${loc} 找不到插入锚点`); continue }
  const indent = (lines[at].match(/^\s*/) || ['    '])[0]
  const block = missing.map(([zh, tr]) => {
    const t = tr[loc]
    if (!t) throw new Error(`${loc} 缺 ${zh} 的译文`)
    return `${indent}${JSON.stringify(zh)}: ${JSON.stringify(t)},`
  })
  lines.splice(at + 1, 0, ...block)
  fs.writeFileSync(file, lines.join(eol), 'utf8')
  changed++
  console.log(`[ok] ${loc} += ${block.length} 条(第 ${at + 2} 行起)`)
}
console.log(`\n完成:${changed} 个语言包更新,共 ${KEYS.length} 条词条(逐条幂等)`)
