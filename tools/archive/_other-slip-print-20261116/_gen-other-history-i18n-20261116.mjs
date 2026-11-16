/**
 * _gen-other-history-i18n-20261116.mjs — 「历史单据 / 查询」相关新词条写进 10 个语言包
 *
 * 用法(仓库根):node tools/archive/_other-slip-print-20261116/_gen-other-history-i18n-20261116.mjs
 * 插入锚点:`'生产退料单': '<译名>',` 之后(10 个文件都有);幂等,已存在就跳过。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('frontend/src/i18n/locales')

const T = {
  '扫单据二维码、输入单号或关键字': {
    en: 'Scan the slip QR code, or enter a document no. / keyword',
    'zh-TW': '掃單據二維碼、輸入單號或關鍵字',
    ja: '伝票QRコードをスキャン、伝票番号またはキーワードを入力',
    ko: '전표 QR 코드를 스캔하거나 전표 번호/키워드를 입력',
    de: 'QR-Code scannen oder Belegnummer/Suchwort eingeben',
    es: 'Escanee el QR o introduzca número de documento / palabra clave',
    fr: 'Scannez le QR code ou saisissez un numéro / mot-clé',
    ru: 'Отсканируйте QR-код или введите номер/ключевое слово',
    th: 'สแกน QR หรือกรอกเลขที่เอกสาร/คำค้น',
    vi: 'Quét mã QR hoặc nhập số phiếu/từ khóa',
  },
  '扫码 = 查询:扫纸上的二维码可直接定位那张单，再点「补打印」': {
    en: 'Scan = search: scanning the QR on the slip locates that document — then tap "Reprint"',
    'zh-TW': '掃碼 = 查詢：掃紙上的二維碼可直接定位那張單，再點「補列印」',
    ja: 'スキャン = 検索:紙のQRコードをスキャンするとその伝票に移動します。その後「再印刷」を押してください',
    ko: '스캔 = 조회: 종이의 QR 코드를 스캔하면 해당 전표로 이동합니다. 그다음 "재출력"을 누르세요',
    de: 'Scannen = Suchen: der QR-Code auf dem Beleg springt zu diesem Beleg – dann „Nachdruck" tippen',
    es: 'Escanear = buscar: el QR del papel localiza ese documento; luego pulse «Reimprimir»',
    fr: 'Scanner = rechercher : le QR code du bon ouvre ce document ; puis touchez « Réimprimer »',
    ru: 'Скан = поиск: QR-код на бумаге открывает этот документ — затем нажмите «Повторная печать»',
    th: 'สแกน = ค้นหา: สแกน QR บนกระดาษเพื่อไปยังเอกสารนั้น แล้วกด "พิมพ์ซ้ำ"',
    vi: 'Quét = tìm kiếm: quét QR trên phiếu để tới phiếu đó, rồi bấm "In lại"',
  },
  没有单据: {
    en: 'No documents', 'zh-TW': '沒有單據', ja: '伝票はありません', ko: '전표가 없습니다',
    de: 'Keine Belege', es: 'Sin documentos', fr: 'Aucun bon',
    ru: 'Документов нет', th: 'ไม่มีเอกสาร', vi: 'Không có phiếu',
  },
  查看明细: {
    en: 'Show details', 'zh-TW': '查看明細', ja: '明細を表示', ko: '상세 보기',
    de: 'Details anzeigen', es: 'Ver detalles', fr: 'Voir le détail',
    ru: 'Показать детали', th: 'ดูรายละเอียด', vi: 'Xem chi tiết',
  },
  收起明细: {
    en: 'Hide details', 'zh-TW': '收合明細', ja: '明細を閉じる', ko: '상세 접기',
    de: 'Details ausblenden', es: 'Ocultar detalles', fr: 'Masquer le détail',
    ru: 'Скрыть детали', th: 'ซ่อนรายละเอียด', vi: 'Ẩn chi tiết',
  },
  没有找到这张单据: {
    en: 'Document not found', 'zh-TW': '找不到這張單據', ja: 'その伝票は見つかりません',
    ko: '해당 전표를 찾을 수 없습니다', de: 'Beleg nicht gefunden', es: 'Documento no encontrado',
    fr: 'Bon introuvable', ru: 'Документ не найден', th: 'ไม่พบเอกสารนี้', vi: 'Không tìm thấy phiếu này',
  },
  查询单据失败: {
    en: 'Failed to query documents', 'zh-TW': '查詢單據失敗', ja: '伝票の検索に失敗しました',
    ko: '전표 조회 실패', de: 'Belegabfrage fehlgeschlagen', es: 'Error al consultar documentos',
    fr: 'Échec de la recherche de bons', ru: 'Не удалось найти документы', th: 'ค้นหาเอกสารไม่สำเร็จ',
    vi: 'Truy vấn phiếu thất bại',
  },
  取单据明细失败: {
    en: 'Failed to load the document lines', 'zh-TW': '取得單據明細失敗', ja: '伝票明細の取得に失敗しました',
    ko: '전표 상세를 불러오지 못했습니다', de: 'Belegpositionen konnten nicht geladen werden',
    es: 'No se pudieron cargar las líneas del documento', fr: 'Impossible de charger les lignes du bon',
    ru: 'Не удалось загрузить строки документа', th: 'โหลดรายการในเอกสารไม่สำเร็จ',
    vi: 'Tải chi tiết phiếu thất bại',
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
    const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`^\\s*['"]${esc}['"]\\s*:`, 'm').test(text)) continue
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
