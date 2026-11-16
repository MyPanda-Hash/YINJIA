/**
 * _gen-return-panel-i18n-20261118.mjs — 生产退料面板词条写进 10 个语言包
 * 用法(仓库根):node tools/archive/_pick-two-docs-20261116/_gen-return-panel-i18n-20261118.mjs
 * 锚点:`'生产退料单': '<译名>',` 之后;幂等。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('frontend/src/i18n/locales')

const T = {
  生产退料: {
    en: 'Production Return', 'zh-TW': '生產退料', ja: '生産材料返却', ko: '생산 자재 반납',
    de: 'Produktionsrückgabe', es: 'Devolución de producción', fr: 'Retour de production',
    ru: 'Возврат в производство', th: 'การคืนวัสดุการผลิต', vi: 'Trả vật tư sản xuất',
  },
  去生产退料: {
    en: 'Go to Production Return', 'zh-TW': '去生產退料', ja: '生産材料返却へ', ko: '생산 자재 반납으로',
    de: 'Zur Produktionsrückgabe', es: 'Ir a devolución de producción', fr: 'Aller au retour de production',
    ru: 'К возврату в производство', th: 'ไปที่การคืนวัสดุ', vi: 'Tới trả vật tư sản xuất',
  },
  可退单据: {
    en: 'Returnable documents', 'zh-TW': '可退單據', ja: '返却可能な伝票', ko: '반납 가능 전표',
    de: 'Rückgabefähige Belege', es: 'Documentos devolvibles', fr: 'Bons retournables',
    ru: 'Документы к возврату', th: 'เอกสารที่คืนได้', vi: 'Phiếu có thể trả',
  },
  可退项数: {
    en: 'Returnable items', 'zh-TW': '可退項數', ja: '返却可能件数', ko: '반납 가능 항목',
    de: 'Rückgabefähige Positionen', es: 'Partidas devolvibles', fr: 'Lignes retournables',
    ru: 'Позиций к возврату', th: 'จำนวนรายการที่คืนได้', vi: 'Số dòng có thể trả',
  },
  退料作业: {
    en: 'Return work', 'zh-TW': '退料作業', ja: '返却作業', ko: '반납 작업',
    de: 'Rückgabe-Arbeit', es: 'Trabajo de devolución', fr: 'Travail de retour',
    ru: 'Работа по возврату', th: 'งานคืนวัสดุ', vi: 'Thao tác trả vật tư',
  },
  加入本次退料: {
    en: 'Add to this return', 'zh-TW': '加入本次退料', ja: '今回の返却に追加', ko: '이번 반납에 추가',
    de: 'Zu dieser Rückgabe hinzufügen', es: 'Añadir a esta devolución', fr: 'Ajouter à ce retour',
    ru: 'Добавить к возврату', th: 'เพิ่มในการคืนครั้งนี้', vi: 'Thêm vào lần trả này',
  },
  本次退料: {
    en: 'This return', 'zh-TW': '本次退料', ja: '今回の返却', ko: '이번 반납',
    de: 'Diese Rückgabe', es: 'Esta devolución', fr: 'Ce retour',
    ru: 'Этот возврат', th: 'การคืนครั้งนี้', vi: 'Lần trả này',
  },
  查询可退单据失败: {
    en: 'Failed to load returnable documents', 'zh-TW': '查詢可退單據失敗', ja: '返却可能な伝票の取得に失敗しました',
    ko: '반납 가능 전표 조회 실패', de: 'Rückgabefähige Belege konnten nicht geladen werden',
    es: 'No se pudieron cargar los documentos devolvibles', fr: 'Échec du chargement des bons retournables',
    ru: 'Не удалось загрузить документы к возврату', th: 'โหลดเอกสารที่คืนได้ไม่สำเร็จ',
    vi: 'Tải phiếu có thể trả thất bại',
  },
  查询可退数量失败: {
    en: 'Failed to load the returnable quantity', 'zh-TW': '查詢可退數量失敗', ja: '返却可能数量の取得に失敗しました',
    ko: '반납 가능 수량 조회 실패', de: 'Rückgabemenge konnte nicht geladen werden',
    es: 'No se pudo cargar la cantidad devolvible', fr: 'Échec du chargement de la quantité retournable',
    ru: 'Не удалось получить количество к возврату', th: 'โหลดจำนวนที่คืนได้ไม่สำเร็จ',
    vi: 'Tải số lượng có thể trả thất bại',
  },
  超过可退数量: {
    en: 'Exceeds the returnable quantity', 'zh-TW': '超過可退數量', ja: '返却可能数量を超えています',
    ko: '반납 가능 수량을 초과했습니다', de: 'Übersteigt die rückgabefähige Menge',
    es: 'Supera la cantidad devolvible', fr: 'Dépasse la quantité retournable',
    ru: 'Превышает количество к возврату', th: 'เกินจำนวนที่คืนได้', vi: 'Vượt quá số lượng có thể trả',
  },
  '只列已领料且材料出库单已审核的单据；扫物料码 → 填退料数量 → 提交生成生产退料单': {
    en: 'Only pick orders that are fully picked and whose material issue has been approved; scan material → enter qty → submit to create a Production Return Note',
    'zh-TW': '只列已領料且材料出庫單已審核的單據；掃物料碼 → 填退料數量 → 提交產生生產退料單',
    ja: '払出済みかつ材料出庫票が承認済みの伝票のみ表示。資材をスキャン → 返却数量を入力 → 送信で生産材料返却票を作成',
    ko: '출고가 끝나고 자재 출고 전표가 승인된 전표만 표시합니다. 자재 스캔 → 반납 수량 입력 → 제출하면 생산 자재 반납 전표가 생성됩니다',
    de: 'Nur Belege, die vollständig entnommen und deren Materialausgaben freigegeben sind; Material scannen → Rückgabemenge eingeben → absenden erzeugt eine Produktionsrückgabe',
    es: 'Solo documentos ya retirados y con la salida de material aprobada; escanee material → indique cantidad → envíe para crear una nota de devolución de producción',
    fr: 'Uniquement les bons prélevés dont la sortie de matière est validée ; scannez la matière → saisissez la quantité → validez pour créer un bon de retour de production',
    ru: 'Только документы, которые полностью выданы и чей расход материала утверждён; сканируйте материал → введите количество → отправьте, чтобы создать накладную возврата',
    th: 'แสดงเฉพาะเอกสารที่เบิกครบและใบเบิกวัสดุได้รับการอนุมัติแล้ว สแกนวัสดุ → กรอกจำนวน → ส่งเพื่อสร้างใบรับคืนวัสดุการผลิต',
    vi: 'Chỉ hiện phiếu đã xuất đủ và phiếu xuất vật tư đã được duyệt; quét vật tư → nhập số lượng → gửi để tạo phiếu trả vật tư sản xuất',
  },
  '没有可退的领料单（需要先领料、且材料出库单被仓管审核）': {
    en: 'No returnable pick orders (the material must be picked first and the issue approved by the warehouse)',
    'zh-TW': '沒有可退的領料單（需要先領料、且材料出庫單被倉管審核）',
    ja: '返却可能な払出伝票がありません（先に払出し、材料出庫票が倉庫に承認される必要があります）',
    ko: '반납 가능한 출고 전표가 없습니다(먼저 출고하고 자재 출고 전표가 창고 승인을 받아야 합니다)',
    de: 'Keine rückgabefähigen Entnahmebelege (erst entnehmen und die Materialausgabe muss vom Lager freigegeben sein)',
    es: 'No hay órdenes de retirada devolvibles (primero hay que retirar y que el almacén apruebe la salida)',
    fr: "Aucun bon de prélèvement retournable (il faut d'abord prélever et que le magasin valide la sortie)",
    ru: 'Нет документов к возврату (сначала выдача и утверждение расхода складом)',
    th: 'ไม่มีใบเบิกที่คืนได้ (ต้องเบิกก่อนและใบเบิกวัสดุต้องได้รับการอนุมัติจากคลัง)',
    vi: 'Không có phiếu xuất nào có thể trả (cần xuất trước và phiếu xuất vật tư phải được kho duyệt)',
  },
}

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'de', 'es', 'fr', 'ru', 'th', 'vi']
const ANCHOR = /^\s*'生产退料单':\s*'.*',\s*$/m
const q = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'

let total = 0
for (const loc of LOCALES) {
  const file = path.join(DIR, `${loc}.js`)
  let text = fs.readFileSync(file, 'utf8')
  const lines = []
  for (const [key, map] of Object.entries(T)) {
    const val = map[loc]
    if (!val) throw new Error(`缺译名: ${loc} / ${key}`)
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`^\\s*['"]${esc}['"]\\s*:`, 'm').test(text)) continue
    lines.push(`    ${q(key)}: ${q(val)},`)
  }
  if (!lines.length) { console.log(`[skip] ${loc} 已齐`); continue }
  const m = text.match(ANCHOR)
  if (!m) throw new Error(`${loc}.js 找不到锚点行`)
  const at = m.index + m[0].length
  text = text.slice(0, at) + '\n' + lines.join('\n') + text.slice(at)
  fs.writeFileSync(file, text, 'utf8')
  total += lines.length
  console.log(`[ok] ${loc} +${lines.length}`)
}
console.log(`\n共写入 ${total} 条`)
