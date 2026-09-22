/**
 * _i18n-final-gaps.cjs — 收尾:补最后 23 个键
 *
 * 两类:① 含占位符的模板(机翻会译坏占位符,仓库规定人工维护)
 *       ② 机翻"原样返回"的短词/缩写(zh-TW 与简体同形、TDS/PH 本就是拉丁缩写)
 * 幂等:已存在跳过。用法:node tools/archive/_i18n-final-gaps.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const DIR = path.join(__dirname, '..', '..', 'frontend', 'src', 'i18n', 'locales')
const L = ['zh-TW', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

const ROWS = [
  ['分发成功，已分配 {n} 张规格书',
    '分發成功，已分配 {n} 張規格書', 'Distributed successfully; {n} specification sheet(s) assigned',
    '配布に成功しました。{n} 件の仕様書を割り当てました', '배포 성공, 규격서 {n}건이 할당되었습니다',
    'Distribución correcta; se asignaron {n} hoja(s) de especificación', 'Distribution réussie ; {n} fiche(s) de spécification attribuée(s)',
    'Erfolgreich verteilt; {n} Spezifikationsblatt/-blätter zugewiesen', 'Распределено успешно; назначено спецификаций: {n}',
    'Phân phối thành công, đã gán {n} bản đặc tả', 'แจกจ่ายสำเร็จ กำหนดเอกสารข้อกำหนด {n} ฉบับ'],
  ['已选 {n} 个商品，预览二维码标签？',
    '已選 {n} 個商品，預覽二維碼標籤？', '{n} item(s) selected. Preview QR code labels?',
    '{n} 件の商品を選択しました。QRコードラベルをプレビューしますか？', '상품 {n}개를 선택했습니다. QR 코드 라벨을 미리 보시겠습니까?',
    '{n} artículo(s) seleccionado(s). ¿Previsualizar etiquetas QR?', '{n} article(s) sélectionné(s). Prévisualiser les étiquettes QR ?',
    '{n} Artikel ausgewählt. QR-Code-Etiketten als Vorschau anzeigen?', 'Выбрано товаров: {n}. Показать предпросмотр QR-этикеток?',
    'Đã chọn {n} sản phẩm. Xem trước nhãn mã QR?', 'เลือกสินค้า {n} รายการ ต้องการดูตัวอย่างฉลาก QR หรือไม่?'],
  ['该产品的规格书 {no} 还没填写提交审批完（当前：{st}），暂不能自动带入 —— 请先在规格书里填好并走完提交审批',
    '該產品的規格書 {no} 還沒填寫提交審批完（當前：{st}），暫不能自動帶入 —— 請先在規格書裡填好並走完提交審批',
    'The specification sheet {no} of this product has not finished submission/approval (current: {st}), so it cannot be auto-filled yet — please complete it and finish submission/approval first.',
    'この製品の仕様書 {no} は提出・承認が完了していません（現在：{st}）。自動入力できません — 先に仕様書に入力し、提出・承認を完了してください。',
    '이 제품의 규격서 {no}는 제출/승인이 완료되지 않았습니다(현재: {st}). 자동 입력할 수 없습니다 — 먼저 규격서를 작성하고 제출/승인을 완료하세요.',
    'La hoja de especificación {no} de este producto no ha completado el envío/aprobación (actual: {st}); no se puede rellenar automáticamente. Complete primero la hoja y finalice el envío/aprobación.',
    "La fiche de spécification {no} de ce produit n'a pas terminé sa soumission/approbation (actuel : {st}) ; le remplissage automatique est impossible. Complétez d'abord la fiche et terminez la soumission/approbation.",
    'Das Spezifikationsblatt {no} für dieses Produkt ist noch nicht eingereicht/genehmigt (aktuell: {st}); automatisches Übernehmen ist nicht möglich. Bitte zuerst das Blatt ausfüllen und Einreichung/Genehmigung abschließen.',
    'Спецификация {no} этого изделия не прошла отправку/утверждение (сейчас: {st}) — автозаполнение невозможно. Сначала заполните спецификацию и завершите отправку/утверждение.',
    'Bản đặc tả {no} của sản phẩm này chưa hoàn tất gửi/duyệt (hiện tại: {st}), nên chưa thể tự động điền — vui lòng hoàn thành bản đặc tả và duyệt xong trước.',
    'เอกสารข้อกำหนด {no} ของผลิตภัณฑ์นี้ยังส่ง/อนุมัติไม่เสร็จ (ปัจจุบัน: {st}) จึงยังเติมอัตโนมัติไม่ได้ — กรุณากรอกในเอกสารและดำเนินการส่ง/อนุมัติให้เสร็จก่อน'],
  ['本表已有 {n} 行，改用规格书 {no} 的 {m} 行内容替换？',
    '本表已有 {n} 行，改用規格書 {no} 的 {m} 行內容替換？',
    'This table already has {n} row(s). Replace them with the {m} row(s) from specification sheet {no}?',
    'この表には既に {n} 行あります。仕様書 {no} の {m} 行の内容で置き換えますか？',
    '이 표에 이미 {n}행이 있습니다. 규격서 {no}의 {m}행 내용으로 교체하시겠습니까?',
    'Esta tabla ya tiene {n} fila(s). ¿Reemplazarlas por las {m} fila(s) de la hoja {no}?',
    'Ce tableau contient déjà {n} ligne(s). Les remplacer par les {m} ligne(s) de la fiche {no} ?',
    'Diese Tabelle hat bereits {n} Zeile(n). Durch die {m} Zeile(n) aus Blatt {no} ersetzen?',
    'В таблице уже {n} строк. Заменить их на {m} строк из спецификации {no}?',
    'Bảng này đã có {n} dòng. Thay bằng {m} dòng từ bản đặc tả {no}?',
    'ตารางนี้มี {n} แถวแล้ว ต้องการแทนที่ด้วย {m} แถวจากเอกสารข้อกำหนด {no} หรือไม่?'],
  ['已按规格书 {no} 自动填充',
    '已按規格書 {no} 自動填充', 'Auto-filled from specification sheet {no}',
    '仕様書 {no} から自動入力しました', '규격서 {no}에서 자동 입력했습니다',
    'Rellenado automáticamente desde la hoja {no}', 'Rempli automatiquement depuis la fiche {no}',
    'Automatisch aus Blatt {no} übernommen', 'Автозаполнение из спецификации {no}',
    'Đã tự động điền từ bản đặc tả {no}', 'เติมอัตโนมัติจากเอกสารข้อกำหนด {no} แล้ว'],
  ['父件 {n}', '父件 {n}', 'Parent item {n}', '親品目 {n}', '모품목 {n}', 'Artículo padre {n}',
    'Article parent {n}', 'Übergeordneter Artikel {n}', 'Родительская позиция {n}', 'Mặt hàng cha {n}', 'รายการหลัก {n}'],
  ['子件 {n}', '子件 {n}', 'Child item {n}', '子品目 {n}', '자품목 {n}', 'Artículo hijo {n}',
    'Article enfant {n}', 'Untergeordneter Artikel {n}', 'Дочерняя позиция {n}', 'Mặt hàng con {n}', 'รายการย่อย {n}'],
  ['已导入 {n} 行', '已匯入 {n} 行', '{n} row(s) imported', '{n} 行をインポートしました', '{n}행을 가져왔습니다',
    '{n} fila(s) importada(s)', '{n} ligne(s) importée(s)', '{n} Zeile(n) importiert', 'Импортировано строк: {n}',
    'Đã nhập {n} dòng', 'นำเข้า {n} แถวแล้ว'],
  // 机翻"原样返回"的短词:zh-TW 需人工确认(台湾用法),拉丁缩写原样保留
  ['查看', '檢視', null, null, null, null, null, null, null, null, null],
  ['模板文件', '範本檔案', null, null, null, null, null, null, null, null, null],
  ['子件', '子件', null, null, null, null, null, null, null, null, null],
  ['完成', '完成', null, null, null, null, null, null, null, null, null],
  ['附件', '附件', null, null, null, null, null, null, null, null, null],
  ['止', '止', null, null, null, null, null, null, null, null, null],
  ['是否受控', '是否受控', null, null, null, null, null, null, null, null, null],
  ['受控日期', '受控日期', null, null, null, null, null, null, null, null, null],
  ['物料', '物料', null, null, null, null, null, null, null, null, null],
  ['全部事件', '全部事件', null, null, null, null, null, null, null, null, null],
  ['近 7 天新增 / 完工', '近 7 天新增 / 完工', null, null, null, null, null, null, null, null, null],
  ['起', '起', null, '起', null, null, null, null, null, null, null],
  ['规格', null, null, null, null, null, null, null, null, null, 'ข้อกำหนด'],
  ['TDS', 'TDS', 'TDS', 'TDS', null, 'TDS', 'TDS', 'TDS', 'TDS', 'TDS', 'TDS'],
  ['PH', null, null, 'PH', null, 'PH', 'PH', 'PH', 'PH', 'PH', 'PH'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/'/g, "\\'")
let total = 0
L.forEach((loc, ci) => {
  const file = path.join(DIR, loc + '.js')
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const bizIdx = lines.findIndex((l) => /^\s*biz:\s*\{/.test(l))
  const add = []
  for (const r of ROWS) {
    const v = r[ci + 1]
    if (v == null) continue                                  // 该语言无需补(null=同源文/缩写)
    const keyLine = "'" + esc(r[0]) + "':"
    if (lines.some((l) => l.includes(keyLine)) || add.some((l) => l.includes(keyLine))) continue
    add.push("    '" + esc(r[0]) + "': '" + esc(v) + "',")
  }
  if (!add.length) { console.log('  = ' + loc + ' 已齐'); return }
  lines.splice(bizIdx + 1, 0, ...add)
  fs.writeFileSync(file, lines.join('\n'))
  total += add.length
  console.log('  + ' + loc + ' 补 ' + add.length + ' 条')
})
console.log('\n共写入 ' + total + ' 条')
