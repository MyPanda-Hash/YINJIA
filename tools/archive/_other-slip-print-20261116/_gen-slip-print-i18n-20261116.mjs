/**
 * _gen-slip-print-i18n-20261116.mjs — 三张扫码单「打印/补打印」的新词条写进 10 个语言包
 *
 * 用法(仓库根):node tools/archive/_other-slip-print-20261116/_gen-slip-print-i18n-20261116.mjs
 *
 * 插入位置:每个 locale 文件里 `'生产退料单': '<译名>',` 之后(该行 10 个文件都有,是最稳的锚点)。
 * 幂等:已存在同名键就跳过。
 */
import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('frontend/src/i18n/locales')

const T = {
  补打印: {
    en: 'Reprint', 'zh-TW': '補列印', ja: '再印刷', ko: '재출력',
    de: 'Nachdruck', es: 'Reimprimir', fr: 'Réimprimer',
    ru: 'Повторная печать', th: 'พิมพ์ซ้ำ', vi: 'In lại',
  },
  '扫单据上的二维码，或直接输入单号': {
    en: 'Scan the QR code on the slip, or type the document number',
    'zh-TW': '掃單據上的二維碼，或直接輸入單號',
    ja: '伝票のQRコードをスキャンするか、伝票番号を入力してください',
    ko: '전표의 QR 코드를 스캔하거나 전표 번호를 입력하세요',
    de: 'QR-Code auf dem Beleg scannen oder Belegnummer eingeben',
    es: 'Escanee el código QR del documento o escriba el número',
    fr: 'Scannez le QR code du bon ou saisissez le numéro',
    ru: 'Отсканируйте QR-код документа или введите номер',
    th: 'สแกน QR บนเอกสาร หรือกรอกเลขที่เอกสาร',
    vi: 'Quét mã QR trên phiếu hoặc nhập số phiếu',
  },
  '扫码或输入单号（如 OO-2026-11-0005）': {
    en: 'Scan or enter document no. (e.g. OO-2026-11-0005)',
    'zh-TW': '掃碼或輸入單號（如 OO-2026-11-0005）',
    ja: 'スキャンまたは伝票番号を入力（例 OO-2026-11-0005）',
    ko: '스캔 또는 전표 번호 입력 (예 OO-2026-11-0005)',
    de: 'Scannen oder Belegnummer eingeben (z. B. OO-2026-11-0005)',
    es: 'Escanee o introduzca el número (p. ej. OO-2026-11-0005)',
    fr: 'Scannez ou saisissez le numéro (ex. OO-2026-11-0005)',
    ru: 'Отсканируйте или введите номер (напр. OO-2026-11-0005)',
    th: 'สแกนหรือกรอกเลขที่เอกสาร (เช่น OO-2026-11-0005)',
    vi: 'Quét hoặc nhập số phiếu (ví dụ OO-2026-11-0005)',
  },
  请扫描单据二维码或输入单号: {
    en: 'Please scan the slip QR code or enter a document number',
    'zh-TW': '請掃描單據二維碼或輸入單號',
    ja: '伝票のQRコードをスキャンするか、伝票番号を入力してください',
    ko: '전표 QR 코드를 스캔하거나 전표 번호를 입력하세요',
    de: 'Bitte QR-Code scannen oder Belegnummer eingeben',
    es: 'Escanee el código QR o introduzca el número',
    fr: 'Scannez le QR code ou saisissez le numéro',
    ru: 'Отсканируйте QR-код или введите номер',
    th: 'โปรดสแกน QR หรือกรอกเลขที่เอกสาร',
    vi: 'Vui lòng quét mã QR hoặc nhập số phiếu',
  },
  已调用本机打印: {
    en: 'Sent to this device’s print dialog', 'zh-TW': '已呼叫本機列印',
    ja: 'この端末の印刷画面を開きました', ko: '이 기기의 인쇄 창을 열었습니다',
    de: 'Druckdialog dieses Geräts geöffnet', es: 'Enviado a la impresión de este equipo',
    fr: 'Envoyé à l’impression de cet appareil', ru: 'Отправлено на печать этого устройства',
    th: 'ส่งไปยังการพิมพ์ของเครื่องนี้แล้ว', vi: 'Đã gửi tới hộp thoại in của thiết bị này',
  },
  这张单还没有退料单号: {
    en: 'This slip has no return document yet', 'zh-TW': '這張單還沒有退料單號',
    ja: 'この伝票にはまだ返却伝票番号がありません', ko: '이 전표에는 아직 반납 전표 번호가 없습니다',
    de: 'Dieser Beleg hat noch keine Rückgabenummer', es: 'Este documento aún no tiene nota de devolución',
    fr: 'Ce bon n’a pas encore de numéro de retour', ru: 'У этого документа ещё нет номера возврата',
    th: 'เอกสารนี้ยังไม่มีเลขที่ใบรับคืน', vi: 'Phiếu này chưa có số phiếu trả',
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
    const exists = new RegExp(`^\\s*['"]${esc}['"]\\s*:`, 'm').test(text)
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
