/**
 * 巡线检验(QC_LINE_PATROL)· 前端 UI 文案多语言注入(一次性脚本,2026-11-14)
 *
 * 口径(AGENTS.md 多语言强制规范):显示层新增文案一律 tt('中文原文'),
 * 译名加进 src/i18n/locales/*.js 的 biz(**10 个语言包全加**,zh-CN 是源语言不重复)。
 *
 * 幂等:逐条检查该语言包里是否已有同名键(有就跳过),只在 biz 对象末尾插一段带注释的块。
 * 用法(仓根):node tools/archive/_qc-line-patrol-20261114/ui/_add-line-patrol-i18n.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DIR = path.join(ROOT, 'frontend/src/i18n/locales')

/** 10 个语言包(zh-CN = 源语言,中文原文即显示,不插) */
const LOCALES = ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

/**
 * 新增文案(键 = 中文原文,与组件/菜单里的 tt('…') 逐字一致)。
 * ⚠ 数据键(字段列名)不翻译 —— 这里只翻**显示层**标签。
 */
const T = {
  '巡线检验': {
    en: 'Line Patrol Inspection', 'zh-TW': '巡線檢驗', ja: '巡線検査', ko: '순회 검사',
    es: 'Inspección de línea', fr: 'Inspection de ligne', de: 'Linienprüfung',
    ru: 'Обходной контроль', vi: 'Kiểm tra tuần tuyến', th: 'การตรวจสอบไลน์',
  },
  '成型车间巡线记录表': {
    en: 'Forming Workshop Line Patrol Record', 'zh-TW': '成型車間巡線記錄表',
    ja: '成型工場巡線記録表', ko: '성형 공정 순회 기록표',
    es: 'Registro de inspección de línea del taller de moldeo',
    fr: "Registre d'inspection de ligne de l'atelier de formage",
    de: 'Linienrundgang-Protokoll der Formgebungsabteilung',
    ru: 'Журнал обхода линии формовочного цеха',
    vi: 'Phiếu tuần tuyến phân xưởng tạo hình', th: 'บันทึกการตรวจไลน์แผนกขึ้นรูป',
  },
  '巡线时间': {
    en: 'Patrol Time', 'zh-TW': '巡線時間', ja: '巡線時刻', ko: '순회 시간',
    es: 'Hora de inspección', fr: "Heure d'inspection", de: 'Prüfzeit',
    ru: 'Время обхода', vi: 'Thời gian tuần tuyến', th: 'เวลาตรวจไลน์',
  },
  '巡线人员': {
    en: 'Patrol Inspector', 'zh-TW': '巡線人員', ja: '巡線担当者', ko: '순회 담당자',
    es: 'Inspector de línea', fr: 'Inspecteur de ligne', de: 'Prüfer',
    ru: 'Обходчик', vi: 'Nhân viên tuần tuyến', th: 'ผู้ตรวจไลน์',
  },
  '产品信息确认（重点产品标注★）': {
    en: 'Product Information Confirmation (mark key products with ★)',
    'zh-TW': '產品資訊確認（重點產品標註★）',
    ja: '製品情報確認（重点製品に★印）',
    ko: '제품 정보 확인(중점 제품 ★표시)',
    es: 'Confirmación de información del producto (marcar con ★ los productos clave)',
    fr: 'Confirmation des informations produit (★ pour les produits clés)',
    de: 'Produktdatenbestätigung (Schlüsselprodukte mit ★ markieren)',
    ru: 'Подтверждение данных изделия (ключевые изделия отметить ★)',
    vi: 'Xác nhận thông tin sản phẩm (sản phẩm trọng điểm đánh dấu ★)',
    th: 'ยืนยันข้อมูลผลิตภัณฑ์ (ทำเครื่องหมาย ★ ที่ผลิตภัณฑ์สำคัญ)',
  },
  '炭棒长度范围mm': {
    en: 'Carbon Rod Length Range mm', 'zh-TW': '炭棒長度範圍mm', ja: '炭棒長さ範囲mm',
    ko: '탄소봉 길이 범위mm', es: 'Rango de longitud de varilla de carbono mm',
    fr: 'Plage de longueur de tige carbone mm', de: 'Kohlenstoffstab-Längenbereich mm',
    ru: 'Диапазон длины угольного стержня, мм', vi: 'Phạm vi chiều dài thanh carbon mm',
    th: 'ช่วงความยาวแท่งคาร์บอน mm',
  },
  '内径检查mm': {
    en: 'Inner Diameter Check mm', 'zh-TW': '內徑檢查mm', ja: '内径検査mm',
    ko: '내경 검사mm', es: 'Comprobación de diámetro interior mm',
    fr: 'Contrôle du diamètre intérieur mm', de: 'Innendurchmesser-Prüfung mm',
    ru: 'Контроль внутреннего диаметра, мм', vi: 'Kiểm tra đường kính trong mm',
    th: 'ตรวจวัดเส้นผ่านศูนย์กลางใน mm',
  },
  '重量范围g': {
    en: 'Weight Range g', 'zh-TW': '重量範圍g', ja: '重量範囲g', ko: '중량 범위g',
    es: 'Rango de peso g', fr: 'Plage de poids g', de: 'Gewichtsbereich g',
    ru: 'Диапазон массы, г', vi: 'Phạm vi trọng lượng g', th: 'ช่วงน้ำหนัก g',
  },
  '两液密度（伊玛印品耐水煮要求测试）': {
    en: 'Two-Liquid Density (Yima printed products boil-resistance test)',
    'zh-TW': '兩液密度（伊瑪印品耐水煮要求測試）',
    ja: '二液密度（イマ印刷品耐煮沸試験）',
    ko: '2액 밀도(이마 인쇄품 내수비등 시험)',
    es: 'Densidad de dos líquidos (prueba de resistencia a ebullición de productos impresos Yima)',
    fr: "Densité des deux liquides (essai de résistance à l'ébullition des produits imprimés Yima)",
    de: 'Zwei-Flüssigkeiten-Dichte (Kochfestigkeitstest für Yima-Druckprodukte)',
    ru: 'Плотность двух жидкостей (тест на стойкость к кипячению печатной продукции Yima)',
    vi: 'Mật độ hai dung dịch (thử độ chịu nước sôi của sản phẩm in Yima)',
    th: 'ความหนาแน่นของเหลวสองชนิด (ทดสอบความทนน้ำเดือดของงานพิมพ์ Yima)',
  },
  '表面状态': {
    en: 'Surface Condition', 'zh-TW': '表面狀態', ja: '表面状態', ko: '표면 상태',
    es: 'Estado de la superficie', fr: 'État de surface', de: 'Oberflächenzustand',
    ru: 'Состояние поверхности', vi: 'Trạng thái bề mặt', th: 'สภาพผิว',
  },
  '结果判定': {
    en: 'Result Judgment', 'zh-TW': '結果判定', ja: '結果判定', ko: '결과 판정',
    es: 'Determinación del resultado', fr: 'Détermination du résultat',
    de: 'Ergebnisfeststellung', ru: 'Заключение по результату', vi: 'Đánh giá kết quả',
    th: 'การตัดสินผล',
  },
  '标准值': {
    en: 'Standard', 'zh-TW': '標準值', ja: '基準値', ko: '기준값',
    es: 'Valor estándar', fr: 'Valeur standard', de: 'Sollwert',
    ru: 'Нормативное значение', vi: 'Giá trị tiêu chuẩn', th: 'ค่ามาตรฐาน',
  },
  '实测': {
    en: 'Measured', 'zh-TW': '實測', ja: '実測', ko: '실측',
    es: 'Medido', fr: 'Mesuré', de: 'Gemessen',
    ru: 'Фактическое значение', vi: 'Đo thực tế', th: 'ค่าวัดจริง',
  },
  '增删': {
    en: 'Add/Del', 'zh-TW': '增刪', ja: '追加/削除', ko: '추가/삭제',
    es: 'Añadir/Elim', fr: 'Ajout/Suppr', de: 'Hinzu/Löschen',
    ru: 'Доб./Удал.', vi: 'Thêm/Xóa', th: 'เพิ่ม/ลบ',
  },
  '在本块之后插入一块': {
    en: 'Insert a block after this one', 'zh-TW': '在本塊之後插入一塊',
    ja: 'このブロックの後に挿入', ko: '이 블록 뒤에 삽입',
    es: 'Insertar un bloque después de este', fr: 'Insérer un bloc après celui-ci',
    de: 'Block danach einfügen', ru: 'Вставить блок после этого',
    vi: 'Chèn một khối sau khối này', th: 'แทรกบล็อกถัดจากนี้',
  },
  '删除本块': {
    en: 'Delete this block', 'zh-TW': '刪除本塊', ja: 'このブロックを削除',
    ko: '이 블록 삭제', es: 'Eliminar este bloque', fr: 'Supprimer ce bloc',
    de: 'Diesen Block löschen', ru: 'Удалить этот блок', vi: 'Xóa khối này',
    th: 'ลบบล็อกนี้',
  },
  '新增巡线记录': {
    en: 'Add Patrol Record', 'zh-TW': '新增巡線記錄', ja: '巡線記録を追加',
    ko: '순회 기록 추가', es: 'Añadir registro de inspección',
    fr: "Ajouter un enregistrement d'inspection", de: 'Rundgangseintrag hinzufügen',
    ru: 'Добавить запись обхода', vi: 'Thêm bản ghi tuần tuyến',
    th: 'เพิ่มบันทึกการตรวจไลน์',
  },
  '暂无巡线记录': {
    en: 'No patrol records', 'zh-TW': '暫無巡線記錄', ja: '巡線記録なし',
    ko: '순회 기록 없음', es: 'Sin registros de inspección',
    fr: "Aucun enregistrement d'inspection", de: 'Keine Rundgangseinträge',
    ru: 'Нет записей обхода', vi: 'Chưa có bản ghi tuần tuyến',
    th: 'ยังไม่มีบันทึกการตรวจไลน์',
  },
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const hasKey = (src, key) => new RegExp(`['"]${esc(key)}['"]\\s*:`).test(src)

let failed = false
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  let src = fs.readFileSync(file, 'utf8')
  const keys = Object.keys(T)
  const missing = keys.filter((k) => !hasKey(src, k))
  if (!missing.length) {
    console.log(`[skip] ${loc}: 全部 ${keys.length} 条已存在`)
    continue
  }
  const lines = missing.map((k) => {
    const val = T[k][loc]
    if (!val) { failed = true; console.error(`[FAIL] ${loc} 缺词条: ${k}`); return null }
    return `    ${JSON.stringify(k)}: ${JSON.stringify(val)},`
  }).filter(Boolean)
  const block = `    // ---- 巡线检验 · 成型车间巡线记录表(QC_LINE_PATROL,2026-11-14)----\n${lines.join('\n')}\n`
  const marker = '  },\n\n}\n'
  const at = src.lastIndexOf(marker)
  if (at < 0) { failed = true; console.error(`[FAIL] ${loc}: 未找到 biz 对象结尾,跳过`); continue }
  src = src.slice(0, at) + block + src.slice(at)
  fs.writeFileSync(file, src)
  console.log(`[ok] ${loc}: 新增 ${missing.length} 条(${keys.length - missing.length} 条已存在)`)
}
if (failed) process.exit(1)
console.log('done')
