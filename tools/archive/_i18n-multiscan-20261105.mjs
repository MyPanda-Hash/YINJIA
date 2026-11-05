/**
 * _i18n-multiscan-i18n-20261105.mjs — 「扫多张」相关文案补进 9 个语言包
 *
 * 用法(仓库根):node tools/archive/_i18n-multiscan-20261105.mjs [--write|--audit]
 * --audit 只列 MobilePickCreate.vue 里缺译名的 tt() 文案。
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const locDir = resolve(root, 'frontend/src/i18n/locales')
const vueFile = resolve(root, 'frontend/src/views/mobile/MobilePickCreate.vue')
const WRITE = process.argv.includes('--write')
const AUDIT = process.argv.includes('--audit')

const LOCALES = { en: 1, ja: 2, ko: 3, es: 4, fr: 5, de: 6, ru: 7, vi: 8, th: 9 }

/** [中文, en, ja, ko, es, fr, de, ru, vi, th] */
const ROWS = [
  ['扫多张', 'Scan many', '複数スキャン', '여러 개 스캔', 'Escanear varios', 'Scanner plusieurs', 'Mehrere scannen', 'Сканировать несколько', 'Quét nhiều', 'สแกนหลายรายการ'],
  ['「扫多张」= 一次扫多个工单码(按纸面顺序列出、可勾选),它们会一起进下面的待生成队列,再点「批量生成」逐张建单', '"Scan many" = scan several work-order codes at once (listed in sheet order, tick to choose); they all go into the pending queue below, then tap "Batch create" to create one slip per work order', '「複数スキャン」= 作業指示QRをまとめて読み取り(用紙順に表示・チェック可)。下の待ち行列に入り、「一括作成」で1件ずつ伝票を作成します', '"여러 개 스캔" = 작업지시 QR을 한 번에 여러 개 읽기(용지 순서로 표시, 선택 가능). 아래 대기열에 쌓이고 "일괄 생성"으로 한 건씩 전표를 만듭니다', '«Escanear varios» = lee varios códigos de OT a la vez (en el orden de la hoja, seleccionables); van a la cola inferior y con «Crear por lote» se crea un vale por OT', '« Scanner plusieurs » = lit plusieurs codes d\'OF (dans l\'ordre de la feuille, cochables) ; ils vont dans la file ci-dessous, puis « Créer par lot » fait un bon par OF', '„Mehrere scannen" = mehrere Auftrags-QR auf einmal (in Blattreihenfolge, ankreuzbar); sie landen unten in der Warteschlange, „Sammel-Erstellen" erzeugt je Auftrag einen Beleg', '«Сканировать несколько» — несколько QR заказов сразу (в порядке листа, с отметкой); попадают в очередь ниже, «Пакетное создание» делает по накладной на заказ', '"Quét nhiều" = quét nhiều mã lệnh sản xuất cùng lúc (theo thứ tự trên giấy, chọn được); vào hàng đợi bên dưới, bấm "Tạo hàng loạt" để tạo phiếu từng lệnh', '"สแกนหลายรายการ" = อ่าน QR ใบสั่งผลิตหลายใบพร้อมกัน (เรียงตามกระดาษ เลือกได้) เข้าคิวด้านล่าง แล้วกด "สร้างแบบกลุ่ม" เพื่อสร้างเอกสารทีละใบ'],
  ['已加入', 'Added', '追加しました', '추가됨', 'Añadidos', 'Ajoutés', 'Hinzugefügt', 'Добавлено', 'Đã thêm', 'เพิ่มแล้ว'],
  ['张工单', 'work orders', '件の指示', '건의 작업지시', 'órdenes', 'OF', 'Aufträge', 'заказов', 'lệnh', 'ใบสั่ง'],
  ['跳过', 'skipped', 'スキップ', '건너뜀', 'omitidos', 'ignorés', 'übersprungen', 'пропущено', 'bỏ qua', 'ข้าม'],
  ['没有可加入的工单码', 'No usable work-order code found', '追加できる作業指示QRがありません', '추가할 작업지시 QR이 없습니다', 'No hay códigos de OT utilizables', 'Aucun code d\'OF exploitable', 'Keine verwertbaren Auftrags-QR', 'Нет подходящих QR заказов', 'Không có mã lệnh sản xuất dùng được', 'ไม่มี QR ใบสั่งผลิตที่ใช้ได้'],
  ['当前 App 版本不支持多选扫码:请升级到 1.0.2 及以上', 'This app version cannot scan multiple codes: please upgrade to 1.0.2 or later', 'このアプリ版は複数スキャン非対応です。1.0.2 以降に更新してください', '이 앱 버전은 다중 스캔을 지원하지 않습니다. 1.0.2 이상으로 업그레이드하세요', 'Esta versión no admite escaneo múltiple: actualice a 1.0.2 o superior', 'Cette version ne gère pas le scan multiple : passez à 1.0.2 ou plus', 'Diese App-Version kann nicht mehrfach scannen: bitte auf 1.0.2+ aktualisieren', 'Эта версия приложения не поддерживает множественное сканирование: обновите до 1.0.2+', 'Bản app này không hỗ trợ quét nhiều: vui lòng nâng lên 1.0.2 trở lên', 'แอปเวอร์ชันนี้ไม่รองรับการสแกนหลายรายการ กรุณาอัปเดตเป็น 1.0.2 ขึ้นไป'],
  // 补一条历史缺口:模板用短句,语言包里只有带「扫工单码:」前缀的长句
  ['按工单行的产品取《组装BOM表》,生成一张领料单和一张退料单(退料数量默认 0),并自动打印一次工单二维码', 'Looks up the Assembly BOM for that line\'s product, creates one picking slip and one return slip (return qty 0), and auto-prints the work-order QR once', '行の製品の組立BOMから払出伝票と返却伝票を1枚ずつ作成(返却数量は既定0)、作業指示QRを自動印刷します', '해당 라인 제품의 조립 BOM으로 출고전표와 반납전표를 각 1장 생성(반납수량 기본 0), 작업지시 QR 자동 인쇄', 'Busca el BOM de ensamble del producto de la línea, crea un vale de retirada y uno de devolución (cant. 0) e imprime el QR una vez', 'Recherche la nomenclature d\'assemblage, crée un bon de prélèvement et un de retour (qté 0) et imprime le QR une fois', 'Liest die Montage-BOM, erstellt Entnahme- und Rückgabeschein (Menge 0) und druckt den QR einmal', 'По BOM сборки создаются накладные выдачи и возврата (кол-во 0) и печатается QR', 'Lấy BOM lắp ráp, tạo phiếu xuất và phiếu trả (số lượng 0) và in mã QR một lần', 'ดึง BOM ประกอบ สร้างใบเบิกและใบคืน (จำนวน 0) และพิมพ์ QR หนึ่งครั้ง'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")
const unesc = (s) => s.replace(/\\\\/g, '\\').replace(/\\'/g, "'")

if (AUDIT) {
  const src = readFileSync(vueFile, 'utf8')
  const en = readFileSync(resolve(locDir, 'en.js'), 'utf8')
  const uniq = new Set()
  for (const m of src.matchAll(/tt\('([^']*)'\)/g)) uniq.add(unesc(m[1]))
  const miss = [...uniq].filter((k) => !en.includes(`'${esc(k)}':`))
  console.log(`tt() 文案 ${uniq.size} 条,缺译名 ${miss.length} 条`)
  miss.forEach((k) => console.log('  缺: ' + k))
  process.exit(0)
}

for (const [loc, idx] of Object.entries(LOCALES)) {
  const file = resolve(locDir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const missing = ROWS.filter((r) => !src.includes(`'${esc(r[0])}':`))
  if (!missing.length) { console.log(`[SKIP] ${loc}`); continue }
  if (!WRITE) { console.log(`[DRY] ${loc}: 缺 ${missing.length}`); continue }
  const lines = missing.map((r) => `    '${esc(r[0])}': '${esc(r[idx])}',`)
  const lastClose = src.lastIndexOf('\n  }')
  if (lastClose < 0) { console.error(`[FAIL] ${loc}: 找不到 biz 收尾`); continue }
  writeFileSync(file, src.slice(0, lastClose) + '\n' + lines.join('\n') + src.slice(lastClose), 'utf8')
  console.log(`[OK]   ${loc}: +${missing.length}`)
}
