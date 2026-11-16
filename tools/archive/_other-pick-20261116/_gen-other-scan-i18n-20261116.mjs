/**
 * _gen-other-scan-i18n-20261116.mjs — 把「其他领料 / 其他退料」页面的新词条批量写进 10 个语言包
 *
 * 用法(仓库根):node tools/archive/_other-pick-20261116/_gen-other-scan-i18n-20261116.mjs
 *
 * 插入位置:每个 locale 文件里 `'生产退料单': '<译名>',` 这一行之后
 *  —— 那一行是 2026-11-16 上一批(生产领料明细表/生产退料明细表/生产退料单)统一插入的,
 *  10 个文件都有、且内容各不相同,是最稳的锚点(不依赖各文件的行号或相邻键)。
 *
 * 幂等:已存在同名键就跳过。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('frontend/src/i18n/locales')

/** key → 各语言译名(zh-CN 是源语言,不写) */
const T = {
  其他领料: {
    en: 'Other Picking', 'zh-TW': '其他領料', ja: 'その他払出', ko: '기타 출고',
    de: 'Sonstige Entnahme', es: 'Otra retirada', fr: 'Autre prélèvement',
    ru: 'Прочая выдача', th: 'เบิกอื่นๆ', vi: 'Xuất khác',
  },
  其他退料: {
    en: 'Other Return', 'zh-TW': '其他退料', ja: 'その他返却', ko: '기타 반납',
    de: 'Sonstige Rückgabe', es: 'Otra devolución', fr: 'Autre retour',
    ru: 'Прочий возврат', th: 'คืนอื่นๆ', vi: 'Trả khác',
  },
  其他领料清单: {
    en: 'Other Picking List', 'zh-TW': '其他領料清單', ja: 'その他払出一覧', ko: '기타 출고 목록',
    de: 'Liste sonstige Entnahme', es: 'Lista de otra retirada', fr: 'Liste autre prélèvement',
    ru: 'Список прочей выдачи', th: 'รายการเบิกอื่นๆ', vi: 'Danh sách xuất khác',
  },
  其他退料清单: {
    en: 'Other Return List', 'zh-TW': '其他退料清單', ja: 'その他返却一覧', ko: '기타 반납 목록',
    de: 'Liste sonstige Rückgabe', es: 'Lista de otra devolución', fr: 'Liste autre retour',
    ru: 'Список прочего возврата', th: 'รายการคืนอื่นๆ', vi: 'Danh sách trả khác',
  },
  '扫描或输入物料码（存货编码|批号）': {
    en: 'Scan or enter material code (code|lot)', 'zh-TW': '掃描或輸入物料碼（存貨編碼|批號）',
    ja: '資材コードをスキャンまたは入力（コード|ロット）', ko: '자재 코드를 스캔하거나 입력 (코드|로트)',
    de: 'Materialcode scannen oder eingeben (Code|Charge)',
    es: 'Escanee o introduzca el código de material (código|lote)',
    fr: 'Scannez ou saisissez le code matière (code|lot)',
    ru: 'Отсканируйте или введите код материала (код|партия)',
    th: 'สแกนหรือกรอกรหัสวัสดุ (รหัส|ล็อต)', vi: 'Quét hoặc nhập mã vật tư (mã|lô)',
  },
  退到仓库: {
    en: 'Return to warehouse', 'zh-TW': '退到倉庫', ja: '返却先倉庫', ko: '반납 창고',
    de: 'Rückgabe an Lager', es: 'Devolver al almacén', fr: 'Retour vers entrepôt',
    ru: 'Вернуть на склад', th: 'คืนเข้าคลัง', vi: 'Trả về kho',
  },
  请选择仓库: {
    en: 'Select a warehouse', 'zh-TW': '請選擇倉庫', ja: '倉庫を選択してください', ko: '창고를 선택하세요',
    de: 'Lager auswählen', es: 'Seleccione un almacén', fr: 'Sélectionnez un entrepôt',
    ru: 'Выберите склад', th: 'เลือกคลัง', vi: 'Chọn kho',
  },
  请扫描或输入物料码: {
    en: 'Please scan or enter a material code', 'zh-TW': '請掃描或輸入物料碼',
    ja: '資材コードをスキャンまたは入力してください', ko: '자재 코드를 스캔하거나 입력하세요',
    de: 'Bitte Materialcode scannen oder eingeben', es: 'Escanee o introduzca un código de material',
    fr: 'Scannez ou saisissez un code matière', ru: 'Отсканируйте или введите код материала',
    th: 'โปรดสแกนหรือกรอกรหัสวัสดุ', vi: 'Vui lòng quét hoặc nhập mã vật tư',
  },
  '没找到这个物料：请核对物料编码': {
    en: 'Material not found: please check the material code', 'zh-TW': '找不到這個物料：請核對物料編碼',
    ja: '資材が見つかりません:コードを確認してください', ko: '자재를 찾을 수 없습니다: 코드를 확인하세요',
    de: 'Material nicht gefunden: Code prüfen', es: 'Material no encontrado: revise el código',
    fr: 'Matière introuvable : vérifiez le code', ru: 'Материал не найден: проверьте код',
    th: 'ไม่พบวัสดุ: โปรดตรวจสอบรหัส', vi: 'Không tìm thấy vật tư: vui lòng kiểm tra mã',
  },
  这个物料目前没有可用库存: {
    en: 'This material has no available stock', 'zh-TW': '這個物料目前沒有可用庫存',
    ja: 'この資材は現在在庫がありません', ko: '이 자재는 현재 가용 재고가 없습니다',
    de: 'Für dieses Material ist kein Bestand verfügbar', es: 'Este material no tiene existencias disponibles',
    fr: 'Aucun stock disponible pour cette matière', ru: 'Для этого материала нет доступного запаса',
    th: 'วัสดุนี้ไม่มีสต็อกที่ใช้ได้', vi: 'Vật tư này hiện không có tồn khả dụng',
  },
  请先扫码选中一个物料: {
    en: 'Scan and select a material first', 'zh-TW': '請先掃描選中一個物料',
    ja: '先に資材をスキャンして選択してください', ko: '먼저 자재를 스캔해 선택하세요',
    de: 'Zuerst ein Material scannen und auswählen', es: 'Primero escanee y seleccione un material',
    fr: "Scannez et sélectionnez d'abord une matière", ru: 'Сначала отсканируйте и выберите материал',
    th: 'โปรดสแกนและเลือกวัสดุก่อน', vi: 'Hãy quét và chọn vật tư trước',
  },
  请选择退到哪个仓库: {
    en: 'Select which warehouse to return to', 'zh-TW': '請選擇退到哪個倉庫',
    ja: '返却先の倉庫を選択してください', ko: '반납할 창고를 선택하세요',
    de: 'Wählen Sie das Rückgabelager', es: 'Seleccione a qué almacén devolver',
    fr: "Sélectionnez l'entrepôt de retour", ru: 'Выберите склад возврата',
    th: 'เลือกคลังที่จะคืน', vi: 'Chọn kho để trả về',
  },
  生成其他出库单失败: {
    en: 'Failed to create the other issue document', 'zh-TW': '產生其他出庫單失敗',
    ja: 'その他出庫票の作成に失敗しました', ko: '기타 출고 전표 생성 실패',
    de: 'Beleg „Sonstige Ausgabe" konnte nicht erstellt werden',
    es: 'No se pudo crear la nota de otra salida', fr: "Échec de création du bon d'autre sortie",
    ru: 'Не удалось создать документ прочего расхода', th: 'สร้างเอกสารเบิกอื่นไม่สำเร็จ',
    vi: 'Tạo phiếu xuất khác thất bại',
  },
  生成生产退料单失败: {
    en: 'Failed to create the production return note', 'zh-TW': '產生生產退料單失敗',
    ja: '生産材料返却票の作成に失敗しました', ko: '생산 자재 반납 전표 생성 실패',
    de: 'Beleg „Produktionsrückgabe" konnte nicht erstellt werden',
    es: 'No se pudo crear la nota de devolución de producción',
    fr: 'Échec de création du bon de retour de production',
    ru: 'Не удалось создать накладную возврата в производство',
    th: 'สร้างใบรับคืนวัสดุการผลิตไม่สำเร็จ', vi: 'Tạo phiếu trả vật tư sản xuất thất bại',
  },
  '已生成生产退料单，请到生产退料单里审核': {
    en: 'Production return note created — please review it in Production Return Note',
    'zh-TW': '已產生生產退料單，請到生產退料單裡審核',
    ja: '生産材料返却票を作成しました。「生産材料返却票」で承認してください',
    ko: "생산 자재 반납 전표가 생성되었습니다. '생산 자재 반납 전표'에서 승인하세요",
    de: 'Produktionsrückgabe erstellt – bitte im Beleg „Produktionsrückgabe" prüfen',
    es: 'Nota de devolución creada: revísela en «Nota de devolución de producción»',
    fr: 'Bon de retour créé — à valider dans « Note de retour de production »',
    ru: 'Накладная возврата создана — утвердите её в «Накладная на возврат в производство»',
    th: 'สร้างใบรับคืนวัสดุการผลิตแล้ว โปรดตรวจสอบใน "ใบรับคืนวัสดุการผลิต"',
    vi: 'Đã tạo phiếu trả vật tư sản xuất — vui lòng duyệt trong "Phiếu trả vật tư sản xuất"',
  },
  '已生成其他出库单，请到其他出库单里审核': {
    en: 'Other issue document created — please review it in Other Issue',
    'zh-TW': '已產生其他出庫單，請到其他出庫單裡審核',
    ja: 'その他出庫票を作成しました。「その他出庫票」で承認してください',
    ko: "기타 출고 전표가 생성되었습니다. '기타 출고 전표'에서 승인하세요",
    de: 'Sonstige Ausgabe erstellt – bitte im Beleg „Sonstige Ausgabe" prüfen',
    es: 'Nota de otra salida creada: revísela en «Otra salida»',
    fr: "Bon d'autre sortie créé — à valider dans « Autre sortie »",
    ru: 'Документ прочего расхода создан — утвердите его в «Прочий расход»',
    th: 'สร้างเอกสารเบิกอื่นแล้ว โปรดตรวจสอบใน "เบิกอื่น"',
    vi: 'Đã tạo phiếu xuất khác — vui lòng duyệt trong "Xuất khác"',
  },
  '扫物料码 → 核对可用量 → 加入清单 → 提交生成其他出库单;提交后接着扫就是另一张单': {
    en: 'Scan material → check availability → add to list → submit creates Other Issue; each submit starts a new document',
    'zh-TW': '掃物料碼 → 核對可用量 → 加入清單 → 提交產生其他出庫單；提交後接著掃就是另一張單',
    ja: '資材をスキャン → 引当量を確認 → 一覧に追加 → 送信でその他出庫票を作成。送信後は続けてスキャンすると別の伝票になります',
    ko: '자재 스캔 → 가용량 확인 → 목록 추가 → 제출하면 기타 출고 전표 생성. 제출 후 다시 스캔하면 새 전표입니다',
    de: 'Material scannen → Verfügbarkeit prüfen → zur Liste hinzufügen → absenden erzeugt „Sonstige Ausgabe"; nach dem Absenden startet der nächste Scan einen neuen Beleg',
    es: 'Escanear material → verificar disponibilidad → añadir a la lista → enviar crea «Otra salida»; tras enviar, el siguiente escaneo abre otro documento',
    fr: "Scanner la matière → vérifier la disponibilité → ajouter à la liste → valider crée « Autre sortie » ; après validation, le scan suivant ouvre un nouveau bon",
    ru: 'Сканировать материал → проверить доступность → добавить в список → отправить создаёт «Прочий расход»; после отправки следующий скан — новый документ',
    th: 'สแกนวัสดุ → ตรวจสอบยอดพร้อมใช้ → เพิ่มในรายการ → ส่งเพื่อสร้าง "เบิกอื่น"; หลังส่งแล้วสแกนต่อจะเป็นเอกสารใหม่',
    vi: 'Quét vật tư → kiểm tra tồn khả dụng → thêm vào danh sách → gửi để tạo "Xuất khác"; sau khi gửi, lần quét tiếp theo là phiếu mới',
  },
  '扫物料码 → 核对仓库/批号 → 加入清单 → 提交生成生产退料单;提交后接着扫就是另一张单': {
    en: 'Scan material → check warehouse/lot → add to list → submit creates Production Return Note; each submit starts a new document',
    'zh-TW': '掃物料碼 → 核對倉庫/批號 → 加入清單 → 提交產生生產退料單；提交後接著掃就是另一張單',
    ja: '資材をスキャン → 倉庫/ロットを確認 → 一覧に追加 → 送信で生産材料返却票を作成。送信後は続けてスキャンすると別の伝票になります',
    ko: '자재 스캔 → 창고/로트 확인 → 목록 추가 → 제출하면 생산 자재 반납 전표 생성. 제출 후 다시 스캔하면 새 전표입니다',
    de: 'Material scannen → Lager/Charge prüfen → zur Liste hinzufügen → absenden erzeugt „Produktionsrückgabe"; nach dem Absenden startet der nächste Scan einen neuen Beleg',
    es: 'Escanear material → verificar almacén/lote → añadir a la lista → enviar crea «Nota de devolución de producción»; tras enviar, el siguiente escaneo abre otro documento',
    fr: "Scanner la matière → vérifier l'entrepôt/le lot → ajouter à la liste → valider crée « Note de retour de production » ; après validation, le scan suivant ouvre un nouveau bon",
    ru: 'Сканировать материал → проверить склад/партию → добавить в список → отправить создаёт «Накладная на возврат в производство»; после отправки следующий скан — новый документ',
    th: 'สแกนวัสดุ → ตรวจสอบคลัง/ล็อต → เพิ่มในรายการ → ส่งเพื่อสร้าง "ใบรับคืนวัสดุการผลิต"; หลังส่งแล้วสแกนต่อจะเป็นเอกสารใหม่',
    vi: 'Quét vật tư → kiểm tra kho/lô → thêm vào danh sách → gửi để tạo "Phiếu trả vật tư sản xuất"; sau khi gửi, lần quét tiếp theo là phiếu mới',
  },
}

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const ANCHOR = /^\s*'生产退料单':\s*'.*',\s*$/m
const q = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"

let total = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  let text = fs.readFileSync(file, 'utf8')
  const lines = []
  for (const [key, map] of Object.entries(T)) {
    const val = map[loc]
    if (!val) throw new Error(`缺译名: ${loc} / ${key}`)
    // 幂等:文件里已有这个键就跳过
    const exists = new RegExp(`^\\s*['"]${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]\\s*:`, 'm').test(text)
    if (exists) continue
    lines.push(`    ${q(key)}: ${q(val)},`)
  }
  if (!lines.length) { console.log(`[skip] ${loc} 已齐`); continue }
  const m = text.match(ANCHOR)
  if (!m) throw new Error(`${loc}.js 找不到锚点行「'生产退料单': ...」`)
  const at = m.index + m[0].length
  text = text.slice(0, at) + '\n' + lines.join('\n') + text.slice(at)
  fs.writeFileSync(file, text, 'utf8')
  total += lines.length
  console.log(`[ok] ${loc} +${lines.length}`)
}
console.log(`\n共写入 ${total} 条`)
