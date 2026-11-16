#!/usr/bin/env node
/**
 * 一次性词条补齐 —— YJ-QR-154《出货检验功能记录表》表样改造 + 「出货检验表观」改名(2026-11-11)。
 *
 * 做两件事(幂等,可反复跑):
 *   1) 逐个语言包**先查后加**:键已存在就跳过(不重复加、不覆盖人工译名);
 *   2) 只补 `_check-qc-yj154-i18n.mjs` 报出来的缺词,全部追加在 `biz` 对象末尾的
 *      「出货检验功能记录表(YJ-QR-154)表样改造」注释块里,方便日后整体 review。
 *
 * 译文口径(en 人工准确;其余语种用简洁译名,专业名词按项目既有译法:出货检验=Outgoing inspection)。
 * 用法(仓库根):node tools/archive/_qc-form-yj154-20261111/_add-qc-yj154-i18n.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../..')
const LOCALES = ['en', 'ja', 'ko', 'zh-TW', 'es', 'de', 'fr', 'ru', 'vi', 'th']

/** 词条表:中文原文(tt 查表键)→ 各语种译名。缺某语种 = 该语种本来就没有/不需要。 */
const T = {
  出货检验表观: {
    en: 'Outgoing Inspection (Appearance)',
    ja: '出荷検査・外観',
    ko: '출하 검사 외관',
    'zh-TW': '出貨檢驗表觀',
    es: 'Inspección de salida (aspecto)',
    de: 'Ausgangsprüfung (Aussehen)',
    fr: 'Contrôle expédition (aspect)',
    ru: 'Контроль отгрузки (внешний вид)',
    vi: 'Kiểm tra xuất hàng (ngoại quan)',
    th: 'การตรวจสอบขาออก (ลักษณะภายนอก)',
  },
  出货检验功能记录表: {
    en: 'Outgoing Inspection Functional Record Sheet',
    ja: '出荷検査機能記録表',
    ko: '출하 검사 기능 기록표',
    'zh-TW': '出貨檢驗功能記錄表',
    es: 'Hoja de registro de inspección funcional de salida',
    de: 'Funktionsprüfprotokoll Ausgang',
    fr: "Fiche d'enregistrement du contrôle fonctionnel expédition",
    ru: 'Ведомость функционального контроля отгрузки',
    vi: 'Phiếu ghi nhận kiểm tra chức năng xuất hàng',
    th: 'บันทึกผลการตรวจสอบการทำงานขาออก',
  },
  表单编号: {
    en: 'Form No.',
    ja: '様式番号',
    ko: '양식 번호',
    'zh-TW': '表單編號',
    es: 'N.º de formulario',
    de: 'Formular-Nr.',
    fr: 'N° de formulaire',
    ru: '№ формы',
    vi: 'Số biểu mẫu',
    th: 'เลขที่แบบฟอร์ม',
  },
  检测周期: {
    en: 'Inspection period',
    ja: '検査期間',
    ko: '검사 주기',
    'zh-TW': '檢測週期',
    es: 'Periodo de inspección',
    de: 'Prüfzeitraum',
    fr: 'Période de contrôle',
    ru: 'Период контроля',
    vi: 'Chu kỳ kiểm tra',
    th: 'ระยะเวลาตรวจสอบ',
  },
  抽检方案: {
    en: 'Sampling plan',
    ja: '抜取検査計画',
    ko: '샘플링 검사 계획',
    'zh-TW': '抽檢方案',
    es: 'Plan de muestreo',
    de: 'Stichprobenplan',
    fr: "Plan d'échantillonnage",
    ru: 'План выборки',
    vi: 'Phương án lấy mẫu',
    th: 'แผนการสุ่มตรวจ',
  },
  检验明细: {
    en: 'Inspection Details',
    ja: '検査明細',
    ko: '검사 명세',
    'zh-TW': '檢驗明細',
    es: 'Detalle de inspección',
    de: 'Prüfdetails',
    fr: 'Détail du contrôle',
    ru: 'Детали контроля',
    vi: 'Chi tiết kiểm tra',
    th: 'รายละเอียดการตรวจสอบ',
  },
  添加批次: {
    en: 'Add Batch',
    ja: 'バッチを追加',
    ko: '배치 추가',
    'zh-TW': '新增批次',
    es: 'Añadir lote',
    de: 'Charge hinzufügen',
    fr: 'Ajouter un lot',
    ru: 'Добавить партию',
    vi: 'Thêm lô',
    th: 'เพิ่มล็อต',
  },
  删除批次: {
    en: 'Delete Batch',
    ja: 'バッチを削除',
    ko: '배치 삭제',
    'zh-TW': '刪除批次',
    es: 'Eliminar lote',
    de: 'Charge löschen',
    fr: 'Supprimer le lot',
    ru: 'Удалить партию',
    vi: 'Xóa lô',
    th: 'ลบล็อต',
  },
  本批结果判断: {
    en: 'Result judgement for this batch',
    ja: '本バッチの判定結果',
    ko: '본 배치 판정 결과',
    'zh-TW': '本批結果判斷',
    es: 'Dictamen de este lote',
    de: 'Beurteilung dieser Charge',
    fr: 'Jugement de ce lot',
    ru: 'Оценка по этой партии',
    vi: 'Phán định lô này',
    th: 'ผลตัดสินของล็อตนี้',
  },
  表单审核人: {
    en: 'Form reviewer',
    ja: '様式承認者',
    ko: '양식 검토자',
    'zh-TW': '表單審核人',
    es: 'Revisor del formulario',
    de: 'Formularprüfer',
    fr: 'Vérificateur du formulaire',
    ru: 'Проверяющий формы',
    vi: 'Người duyệt biểu mẫu',
    th: 'ผู้ทบทวนแบบฟอร์ม',
  },
  // ── 图2 表样其余显示格/列头(新增面板表样 ⇒ 同批补词条)──
  检验项目: {
    en: 'Inspection Item',
    ja: '検査項目',
    ko: '검사 항목',
    'zh-TW': '檢驗項目',
    es: 'Punto de inspección',
    de: 'Prüfposition',
    fr: 'Point de contrôle',
    ru: 'Пункт контроля',
    vi: 'Hạng mục kiểm tra',
    th: 'รายการตรวจสอบ',
  },
  检验方法: {
    en: 'Inspection Method',
    ja: '検査方法',
    ko: '검사 방법',
    'zh-TW': '檢驗方法',
    es: 'Método de inspección',
    de: 'Prüfmethode',
    fr: 'Méthode de contrôle',
    ru: 'Метод контроля',
    vi: 'Phương pháp kiểm tra',
    th: 'วิธีการตรวจสอบ',
  },
  检验要求: {
    en: 'Inspection Requirement',
    ja: '検査要求',
    ko: '검사 요구사항',
    'zh-TW': '檢驗要求',
    es: 'Requisito de inspección',
    de: 'Prüfanforderung',
    fr: 'Exigence de contrôle',
    ru: 'Требование контроля',
    vi: 'Yêu cầu kiểm tra',
    th: 'ข้อกำหนดการตรวจสอบ',
  },
  批次号: {
    en: 'Batch No.',
    ja: 'バッチ番号',
    ko: '배치 번호',
    'zh-TW': '批次號',
    es: 'N.º de lote',
    de: 'Chargennr.',
    fr: 'N° de lot',
    ru: '№ партии',
    vi: 'Số lô',
    th: 'เลขที่ล็อต',
  },
  单据编号: {
    en: 'Document No.',
    ja: '伝票番号',
    ko: '전표 번호',
    'zh-TW': '單據編號',
    es: 'N.º de documento',
    de: 'Beleg-Nr.',
    fr: 'N° de document',
    ru: '№ документа',
    vi: 'Số chứng từ',
    th: 'เลขที่เอกสาร',
  },
  产品编码: {
    en: 'Product Code',
    ja: '製品コード',
    ko: '제품 코드',
    'zh-TW': '產品編碼',
    es: 'Código de producto',
    de: 'Produktcode',
    fr: 'Code produit',
    ru: 'Код изделия',
    vi: 'Mã sản phẩm',
    th: 'รหัสผลิตภัณฑ์',
  },
  产品型号: {
    en: 'Product Model',
    ja: '製品型番',
    ko: '제품 모델',
    'zh-TW': '產品型號',
    es: 'Modelo de producto',
    de: 'Produktmodell',
    fr: 'Modèle du produit',
    ru: 'Модель изделия',
    vi: 'Mẫu sản phẩm',
    th: 'รุ่นผลิตภัณฑ์',
  },
  工单号: {
    en: 'Work Order No.',
    ja: '製造指図番号',
    ko: '작업지시 번호',
    'zh-TW': '工單號',
    es: 'N.º de orden de trabajo',
    de: 'Fertigungsauftrag-Nr.',
    fr: 'N° d’ordre de fabrication',
    ru: '№ наряда',
    vi: 'Số lệnh sản xuất',
    th: 'เลขที่ใบสั่งผลิต',
  },
  检验人: {
    en: 'Inspector',
    ja: '検査者',
    ko: '검사자',
    'zh-TW': '檢驗人',
    es: 'Inspector',
    de: 'Prüfer',
    fr: 'Contrôleur',
    ru: 'Контролёр',
    vi: 'Người kiểm tra',
    th: 'ผู้ตรวจสอบ',
  },
  检验结论: {
    en: 'Inspection Conclusion',
    ja: '検査結論',
    ko: '검사 결론',
    'zh-TW': '檢驗結論',
    es: 'Conclusión de inspección',
    de: 'Prüffazit',
    fr: 'Conclusion du contrôle',
    ru: 'Заключение контроля',
    vi: 'Kết luận kiểm tra',
    th: 'ข้อสรุปการตรวจสอบ',
  },
  审核人: {
    en: 'Reviewer',
    ja: '承認者',
    ko: '검토자',
    'zh-TW': '審核人',
    es: 'Revisor',
    de: 'Freigeber',
    fr: 'Vérificateur',
    ru: 'Проверяющий',
    vi: 'Người duyệt',
    th: 'ผู้ทบทวน',
  },
  处理意见: {
    en: 'Disposition',
    ja: '処理意見',
    ko: '처리 의견',
    'zh-TW': '處理意見',
    es: 'Opinión de tratamiento',
    de: 'Behandlungshinweis',
    fr: 'Avis de traitement',
    ru: 'Решение по обработке',
    vi: 'Ý kiến xử lý',
    th: 'ความเห็นในการจัดการ',
  },
  // ── 旧版组件里已经用、但部分语种缺的词条(顺手补齐,避免切语言后混中文)──
  出货检验记录表: {
    en: 'Outgoing Inspection Record Sheet',
    ja: '出荷検査記録表',
    ko: '출하 검사 기록표',
    'zh-TW': '出貨檢驗記錄表',
    es: 'Hoja de registro de inspección de salida',
    de: 'Ausgangsprüfprotokoll',
    fr: "Fiche d'enregistrement du contrôle expédition",
    ru: 'Ведомость контроля отгрузки',
    vi: 'Phiếu ghi nhận kiểm tra xuất hàng',
    th: 'บันทึกการตรวจสอบขาออก',
  },
  检验结果: {
    en: 'Inspection Result',
    ja: '検査結果',
    ko: '검사 결과',
    'zh-TW': '檢驗結果',
    es: 'Resultado de inspección',
    de: 'Prüfergebnis',
    fr: 'Résultat du contrôle',
    ru: 'Результат контроля',
    vi: 'Kết quả kiểm tra',
    th: 'ผลการตรวจสอบ',
  },
  检验结果及判断: {
    en: 'Inspection result and judgement',
    ja: '検査結果と判定',
    ko: '검사 결과 및 판정',
    'zh-TW': '檢驗結果及判斷',
    es: 'Resultado y dictamen',
    de: 'Prüfergebnis und Beurteilung',
    fr: 'Résultat et jugement',
    ru: 'Результат и оценка',
    vi: 'Kết quả và phán định',
    th: 'ผลตรวจและผลตัดสิน',
  },
  带入检验项目: {
    en: 'Add Inspection Items',
    ja: '検査項目を取り込む',
    ko: '검사 항목 가져오기',
    'zh-TW': '帶入檢驗項目',
    es: 'Añadir puntos de inspección',
    de: 'Prüfpositionen übernehmen',
    fr: 'Ajouter des points de contrôle',
    ru: 'Внести пункты контроля',
    vi: 'Đưa vào hạng mục kiểm tra',
    th: 'นำรายการตรวจสอบเข้า',
  },
  新增检验项: {
    en: 'New Inspection Item',
    ja: '検査項目を追加',
    ko: '검사 항목 추가',
    'zh-TW': '新增檢驗項',
    es: 'Nuevo punto de inspección',
    de: 'Neue Prüfposition',
    fr: 'Nouveau point de contrôle',
    ru: 'Новый пункт контроля',
    vi: 'Thêm hạng mục kiểm tra',
    th: 'เพิ่มรายการตรวจสอบ',
  },
  删除本行: {
    en: 'Delete this row',
    ja: 'この行を削除',
    ko: '이 행 삭제',
    'zh-TW': '刪除此行',
    es: 'Eliminar esta fila',
    de: 'Diese Zeile löschen',
    fr: 'Supprimer cette ligne',
    ru: 'Удалить эту строку',
    vi: 'Xóa dòng này',
    th: 'ลบแถวนี้',
  },
  暂无检验项: {
    en: 'No inspection items',
    ja: '検査項目なし',
    ko: '검사 항목 없음',
    'zh-TW': '暫無檢驗項',
    es: 'Sin puntos de inspección',
    de: 'Keine Prüfpositionen',
    fr: 'Aucun point de contrôle',
    ru: 'Нет пунктов контроля',
    vi: 'Chưa có hạng mục kiểm tra',
    th: 'ยังไม่มีรายการตรวจสอบ',
  },
  出货控制计划执行: {
    en: 'Outgoing control plan execution',
    ja: '出荷管理計画の実施',
    ko: '출하 관리 계획 실행',
    'zh-TW': '出貨控制計畫執行',
    es: 'Ejecución del plan de control de salida',
    de: 'Ausführung des Ausgangskontrollplans',
    fr: 'Exécution du plan de contrôle expédition',
    ru: 'Выполнение плана контроля отгрузки',
    vi: 'Thực hiện kế hoạch kiểm soát xuất hàng',
    th: 'การปฏิบัติตามแผนควบคุมขาออก',
  },
  // ── 新表样组件的交互提示(校验 / 删除确认;2026-11-11 重写 QcProcInspSheet 时新增)──
  批次号不能为空: {
    en: 'Batch No. cannot be empty',
    ja: 'バッチ番号は必須です',
    ko: '배치 번호는 필수입니다',
    'zh-TW': '批次號不能為空',
    es: 'El N.º de lote no puede estar vacío',
    de: 'Chargennr. darf nicht leer sein',
    fr: 'Le N° de lot ne peut pas être vide',
    ru: '№ партии не может быть пустым',
    vi: 'Số lô không được để trống',
    th: 'เลขที่ล็อตต้องไม่ว่าง',
  },
  批次号重复: {
    en: 'Duplicate batch No.',
    ja: 'バッチ番号が重複しています',
    ko: '배치 번호가 중복됩니다',
    'zh-TW': '批次號重複',
    es: 'N.º de lote duplicado',
    de: 'Doppelte Chargennr.',
    fr: 'N° de lot en double',
    ru: 'Дублирующийся № партии',
    vi: 'Số lô bị trùng',
    th: 'เลขที่ล็อตซ้ำ',
  },
  删除检验项: {
    en: 'Delete Inspection Item',
    ja: '検査項目を削除',
    ko: '검사 항목 삭제',
    'zh-TW': '刪除檢驗項',
    es: 'Eliminar punto de inspección',
    de: 'Prüfposition löschen',
    fr: 'Supprimer le point de contrôle',
    ru: 'Удалить пункт контроля',
    vi: 'Xóa hạng mục kiểm tra',
    th: 'ลบรายการตรวจสอบ',
  },
  至少保留一个批次: {
    en: 'Keep at least one batch',
    ja: 'バッチは最低 1 つ必要です',
    ko: '배치를 최소 하나는 남겨야 합니다',
    'zh-TW': '至少保留一個批次',
    es: 'Debe quedar al menos un lote',
    de: 'Mindestens eine Charge muss bleiben',
    fr: 'Conservez au moins un lot',
    ru: 'Должна остаться хотя бы одна партия',
    vi: 'Phải giữ lại ít nhất một lô',
    th: 'ต้องเหลืออย่างน้อยหนึ่งล็อต',
  },
  '删除批次将清空该批次所有判定结果，确定删除吗？': {
    en: 'Deleting the batch clears all its judgement results. Delete anyway?',
    ja: 'バッチを削除すると、このバッチの判定結果がすべて消えます。削除しますか？',
    ko: '배치를 삭제하면 해당 배치의 모든 판정 결과가 지워집니다. 삭제하시겠습니까?',
    'zh-TW': '刪除批次將清空該批次所有判定結果，確定刪除嗎？',
    es: 'Eliminar el lote borra todos sus dictámenes. ¿Eliminar de todos modos?',
    de: 'Beim Löschen der Charge werden alle ihre Beurteilungsergebnisse entfernt. Trotzdem löschen?',
    fr: 'Supprimer le lot efface tous ses jugements. Supprimer quand même ?',
    ru: 'Удаление партии очистит все её оценки. Удалить?',
    vi: 'Xóa lô sẽ xóa toàn bộ phán định của lô này. Vẫn xóa?',
    th: 'การลบล็อตจะล้างผลตัดสินทั้งหมดของล็อตนี้ ยืนยันการลบหรือไม่',
  },
  '删除该项目将清除其所有批次的记录，确定删除吗？': {
    en: 'Deleting this item clears its records for every batch. Delete anyway?',
    ja: 'この項目を削除すると、全バッチの記録が消えます。削除しますか？',
    ko: '이 항목을 삭제하면 모든 배치의 기록이 지워집니다. 삭제하시겠습니까?',
    'zh-TW': '刪除該項目將清除其所有批次的記錄，確定刪除嗎？',
    es: 'Eliminar este punto borra sus registros en todos los lotes. ¿Eliminar de todos modos?',
    de: 'Beim Löschen dieser Position werden ihre Datensätze in allen Chargen entfernt. Trotzdem löschen?',
    fr: 'Supprimer ce point efface ses enregistrements pour tous les lots. Supprimer quand même ?',
    ru: 'Удаление этого пункта очистит его записи по всем партиям. Удалить?',
    vi: 'Xóa hạng mục này sẽ xóa bản ghi của nó ở tất cả các lô. Vẫn xóa?',
    th: 'การลบรายการนี้จะล้างบันทึกของทุกล็อต ยืนยันการลบหรือไม่',
  },
}

/** JS 单引号字符串字面量(转义 \ 和 ') */
function q(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** 该文件里是否已有这个键(单/双引号都认) */
function hasKey(text, key) {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:'|")${esc}(?:'|")\\s*:`).test(text)
}

const HEADER = [
  '    // ---- 出货检验功能记录表 YJ-QR-154 表样改造 + 「组装成品检验单→出货检验表观」改名(2026-11-11)----',
  '    // 键 = 中文原文(tt() 的查表键;数据键永不翻译)。由',
  '    // tools/archive/_qc-form-yj154-20261111/_add-qc-yj154-i18n.mjs 生成,缺词自检见同目录 _check-*.mjs。',
]

let grand = 0
for (const locale of LOCALES) {
  const file = resolve(ROOT, 'frontend/src/i18n/locales', `${locale}.js`)
  const text = readFileSync(file, 'utf8')
  const added = []
  for (const [zh, tr] of Object.entries(T)) {
    const val = tr[locale]
    if (!val) continue                       // 该语种没有这条译名(如 en 已有的不复述)
    if (hasKey(text, zh)) continue            // 已存在 ⇒ 不重复加
    added.push([zh, val])
  }
  if (!added.length) {
    console.log(`${locale.padEnd(6)} 无缺词,跳过`)
    continue
  }
  const block = ['']
  for (const h of HEADER) block.push(h)
  for (const [zh, val] of added) block.push(`    ${q(zh)}: ${q(val)},`)
  const body = block.join('\n')

  // biz 是本文件最后一个顶层键(已核对 10 个文件):插在它收尾的 `  },` 之前
  const idx = text.lastIndexOf('\n  },')
  if (idx < 0) throw new Error(`${locale}.js 找不到 biz 收尾的 "  },"`)
  const out = text.slice(0, idx) + body + text.slice(idx)
  writeFileSync(file, out)

  // 写后立刻自检:文件仍能被 ESM 正常解析(biz 词典能读出来)
  const mod = await import(`file:///${file.replace(/\\/g, '/')}`)
  const biz = (mod.default || mod).biz
  for (const [zh] of added) {
    if (!biz[zh]) throw new Error(`${locale}.js 写入后取不到词条:${zh}`)
  }
  grand += added.length
  console.log(`${locale.padEnd(6)} 补 ${String(added.length).padStart(2)} 条:${added.map(([z]) => z).join(' / ')}`)
}
console.log(`\n合计补词条 ${grand} 条(已存在的一律未动)`)
