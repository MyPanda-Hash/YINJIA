/**
 * _i18n-mobile-scan-20261030.mjs — 把「手机扫码 · 生产领料 / 自动打印」新增 UI 文案补进 9 个语言包
 *
 * 为什么用脚本而不是手改:
 *   本次新增/复用约 90 条词条(3 个新页面),逐个人工编辑 9 个语言包极易漏(AGENTS 硬规范:
 *   新 UI 文案必须走 tt() 且至少有 en 译名;切换语言后不能还是中文)。
 *   脚本做法 = 在 en.js 的 biz 对象**末尾、闭合括号之前**插入一批键值,其余语言包同构补齐。
 *
 * 幂等:已存在的键**不覆盖**(人工校对过的译名优先),只补缺失的。
 *
 * 用法(在 frontend 目录):
 *   node tools/_i18n-mobile-scan-20261030.mjs            # 干跑,只报告
 *   node tools/_i18n-mobile-scan-20261030.mjs --write    # 真写
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const locDir = resolve(here, '../../frontend/src/i18n/locales')
const WRITE = process.argv.includes('--write')

/**
 * 词条表:[中文原文, en, ja, ko, es, fr, de, ru, vi, th]
 * 只收本次新增页面里出现的 tt() 文案;界面上同样的中文在别处已译过的,这里不重复。
 */
const ROWS = [
  // ── 导航 / 页面名 ──
  ['手机扫码', 'Mobile Scanning', 'モバイルスキャン', '모바일 스캔', 'Escaneo móvil', 'Scan mobile', 'Mobiles Scannen', 'Мобильное сканирование', 'Quét di động', 'สแกนมือถือ'],
  ['生产领料', 'Production Picking', '生産材料払出', '생산 자재 출고', 'Retirada de producción', 'Prélèvement de production', 'Produktionsentnahme', 'Выдача в производство', 'Xuất vật tư sản xuất', 'เบิกวัสดุการผลิต'],
  ['生产退料', 'Production Material Return', '生産材料返却', '생산 자재 반납', 'Devolución de producción', 'Retour de production', 'Produktionsrückgabe', 'Возврат в производство', 'Trả vật tư sản xuất', 'คืนวัสดุการผลิต'],
  ['自动打印', 'Auto Print', '自動印刷', '자동 인쇄', 'Impresión automática', 'Impression auto', 'Automatischer Druck', 'Автопечать', 'In tự động', 'พิมพ์อัตโนมัติ'],
  ['领料单据', 'Picking Document', '払出伝票', '자재 출고 전표', 'Documento de retirada', 'Document de prélèvement', 'Entnahmebeleg', 'Документ выдачи', 'Phiếu xuất vật tư', 'เอกสารเบิก materials'],

  // ── 生单 ──
  ['生成工单领料/退料单', 'Create Picking/Return Slips', '払出/返却伝票作成', '출고/반납 전표 생성', 'Crear vale de retirada/devolución', 'Créer bon de prélèvement/retour', 'Entnahme-/Rückgabeschein erstellen', 'Создать накладные выдачи/возврата', 'Tạo phiếu xuất/trả', 'สร้างใบเบิก/คืน'],
  ['按组装BOM表展开用料', 'Exploded from the Assembly BOM', '組立BOMで展開', '조립 BOM 전개', 'Explosionado desde BOM de ensamble', 'Éclaté depuis la nomenclature d\'assemblage', 'Aus Montage-BOM aufgelöst', 'Развёртка по BOM сборки', 'Bung từ BOM lắp ráp', 'แตกจาก BOM ประกอบ'],
  ['扫工单码:按工单行的产品取《组装BOM表》,生成一张领料单和一张退料单(退料数量默认 0),并自动打印一次工单二维码', 'Scan the work-order code: looks up the Assembly BOM for that line\'s product, creates one picking slip and one return slip (return qty defaults to 0), and auto-prints the work-order QR once', '作業指示QRをスキャン:行の製品の組立BOMから払出伝票と返却伝票を1枚ずつ作成(返却数量は既定0)、作業指示QRを自動印刷します', '작업지시 QR 스캔: 해당 라인 제품의 조립 BOM으로 출고전표와 반납전표를 각 1장 생성(반납수량 기본 0), 작업지시 QR 자동 인쇄', 'Escanee el código de OT: busca el BOM de ensamble del producto de la línea, crea un vale de retirada y uno de devolución (cantidad 0) e imprime el QR una vez', 'Scannez le code OF : recherche la nomenclature d\'assemblage, crée un bon de prélèvement et un de retour (qté 0) et imprime le QR une fois', 'Arbeitsauftrags-QR scannen: liest die Montage-BOM, erstellt Entnahme- und Rückgabeschein (Menge 0) und druckt den QR einmal', 'Отсканируйте QR заказа: по BOM сборки создаются накладные выдачи и возврата (кол-во 0) и печатается QR', 'Quét mã lệnh sản xuất: lấy BOM lắp ráp, tạo phiếu xuất và phiếu trả (số lượng 0) và in mã QR một lần', 'สแกน QR ใบสั่งผลิต: ดึง BOM ประกอบ สร้างใบเบิกและใบคืน (จำนวน 0) และพิมพ์ QR หนึ่งครั้ง'],
  ['扫工单码或输入工单号', 'Scan or type the work-order no.', '作業指示QR/番号を入力', '작업지시 QR 또는 번호 입력', 'Escanee o escriba la OT', 'Scannez ou saisissez l\'OF', 'Arbeitsauftrag scannen/eingeben', 'Отсканируйте или введите заказ', 'Quét hoặc nhập lệnh sản xuất', 'สแกนหรือพิมพ์เลขใบสั่งผลิต'],
  ['生成', 'Create', '作成', '생성', 'Crear', 'Créer', 'Erstellen', 'Создать', 'Tạo', 'สร้าง'],
  ['生成失败', 'Create failed', '作成に失敗', '생성 실패', 'Error al crear', 'Échec de création', 'Erstellen fehlgeschlagen', 'Ошибка создания', 'Tạo thất bại', 'สร้างไม่สำเร็จ'],
  ['已生成', 'Created', '作成済み', '생성됨', 'Creado', 'Créé', 'Erstellt', 'Создано', 'Đã tạo', 'สร้างแล้ว'],
  ['该工单行已经开过单,已帮你打开', 'This work-order line already has a slip — opened it for you', 'この行は既に伝票があります。開きました', '이 라인은 이미 전표가 있어 열었습니다', 'Esta línea ya tiene un vale, se ha abierto', 'Cette ligne a déjà un bon, ouvert', 'Diese Zeile hat bereits einen Beleg, geöffnet', 'У этой строки уже есть документ, открыт', 'Dòng này đã có phiếu, đã mở', 'บรรทัดนี้มีเอกสารแล้ว เปิดให้แล้ว'],
  ['该工单行还没有开过领料单:请在上面「生成工单领料/退料单」里扫一次工单', 'No picking slip for this work-order line yet: scan the work order in "Create Picking/Return Slips" above', 'この行の払出伝票はまだありません。上の「払出/返却伝票作成」でスキャンしてください', '이 라인에는 출고전표가 없습니다. 위의 "출고/반납 전표 생성"에서 스캔하세요', 'Esta línea aún no tiene vale: escanee la OT en "Crear vale" arriba', 'Aucun bon pour cette ligne : scannez l\'OF ci-dessus', 'Noch kein Beleg für diese Zeile: oben scannen', 'Нет накладной для этой строки: отсканируйте выше', 'Chưa có phiếu cho dòng này: quét ở mục trên', 'ยังไม่มีเอกสารสำหรับบรรทัดนี้: สแกนด้านบน'],
  ['该工单有多个工单行已开单,请点下面任意一行打开', 'This work order has several lines with slips; tap any line below', 'この指示には複数行の伝票があります。下の行をタップしてください', '여러 라인에 전표가 있습니다. 아래에서 선택하세요', 'Esta OT tiene varias líneas con vales; pulse una', 'Cet OF a plusieurs lignes avec bons ; touchez-en une', 'Mehrere Zeilen mit Belegen; unten tippen', 'Несколько строк с документами; выберите ниже', 'Lệnh này có nhiều dòng có phiếu; chọn bên dưới', 'ใบสั่งนี้มีหลายบรรทัดที่มีเอกสาร แตะด้านล่าง'],
  ['打开这张单', 'Open this slip', 'この伝票を開く', '이 전표 열기', 'Abrir este vale', 'Ouvrir ce bon', 'Diesen Beleg öffnen', 'Открыть документ', 'Mở phiếu này', 'เปิดเอกสารนี้'],
  ['去领料', 'Go picking', '払出へ', '출고하기', 'Ir a retirar', 'Aller au prélèvement', 'Zur Entnahme', 'К выдаче', 'Đi xuất kho', 'ไปเบิก'],

  // ── 列表 ──
  ['扫工单生单 → 扫码核销 → 全部领完提交', 'Scan work order → scan materials → submit when all picked', '指示スキャン→材料スキャン→全数払出で提出', '지시 스캔 → 자재 스캔 → 전량 출고 후 제출', 'Escanee OT → escanee materiales → envíe al completar', 'Scanner OF → scanner matières → soumettre', 'Auftrag scannen → Material scannen → abschließen', 'Заказ → материалы → отправить', 'Quét lệnh → quét vật tư → gửi khi xong', 'สแกนใบสั่ง → สแกนวัสดุ → ส่งเมื่อครบ'],
  ['查询单据', 'Query Slips', '伝票照会', '전표 조회', 'Consultar vales', 'Consulter les bons', 'Belege abfragen', 'Запрос документов', 'Tra cứu phiếu', 'ค้นหาเอกสาร'],
  ['工单号 / 领料单号 / 产品名称', 'Work order / Picking no. / Product', '作業指示/払出番号/製品名', '작업지시/출고번호/품목명', 'OT / Nº retirada / Producto', 'OF / N° prélèvement / Produit', 'Auftrag / Entnahme-Nr. / Produkt', 'Заказ / № выдачи / Изделие', 'Lệnh / Số xuất / Sản phẩm', 'ใบสั่ง / เลขใบเบิก / ชื่อสินค้า'],
  ['扫工单号直接打开对应单据', 'Scan the work-order no. to open its slip', '作業指示番号で伝票を直接開く', '작업지시 번호로 전표 바로 열기', 'Escanee la OT para abrir su vale', 'Scannez l\'OF pour ouvrir son bon', 'Auftrag scannen, um Beleg zu öffnen', 'Отсканируйте заказ, чтобы открыть документ', 'Quét lệnh để mở phiếu', 'สแกนเลขใบสั่งเพื่อเปิดเอกสาร'],
  ['打开单据', 'Open slip', '伝票を開く', '전표 열기', 'Abrir vale', 'Ouvrir le bon', 'Beleg öffnen', 'Открыть документ', 'Mở phiếu', 'เปิดเอกสาร'],
  ['没有未完成的单据', 'No outstanding slips', '未完了の伝票はありません', '미완료 전표 없음', 'No hay vales pendientes', 'Aucun bon en cours', 'Keine offenen Belege', 'Нет незавершённых документов', 'Không có phiếu chưa xong', 'ไม่มีเอกสารที่ยังไม่เสร็จ'],
  ['还没有已完成的单据', 'No completed slips yet', '完了した伝票はまだありません', '완료된 전표 없음', 'Aún no hay vales completados', 'Aucun bon terminé', 'Noch keine abgeschlossenen Belege', 'Завершённых документов пока нет', 'Chưa có phiếu hoàn thành', 'ยังไม่มีเอกสารที่เสร็จแล้ว'],
  ['已领', 'Picked', '払出済', '출고', 'Retirado', 'Prélevé', 'Entnommen', 'Выдано', 'Đã xuất', 'เบิกแล้ว'],
  ['未生成', 'Not created', '未作成', '미생성', 'Sin crear', 'Non créé', 'Nicht erstellt', 'Не создан', 'Chưa tạo', 'ยังไม่สร้าง'],
  ['项未领', 'not picked', '件未払出', '건 미출고', 'sin retirar', 'non prélevé', 'nicht entnommen', 'не выдано', 'chưa xuất', 'ยังไม่เบิก'],
  ['还剩', 'Remaining', '残り', '남은', 'Quedan', 'Reste', 'Verbleibend', 'Осталось', 'Còn lại', 'เหลือ'],
  ['已写入', 'Saved', '保存しました', '저장됨', 'Guardado', 'Enregistré', 'Gespeichert', 'Сохранено', 'Đã lưu', 'บันทึกแล้ว'],

  // ── 单据详情 ──
  ['扫物料码', 'Scan Material Code', '材料QRスキャン', '자재 코드 스캔', 'Escanear código de material', 'Scanner le code matière', 'Materialcode scannen', 'Сканировать код материала', 'Quét mã vật tư', 'สแกนรหัสวัสดุ'],
  ['扫物料码或输入物料编码', 'Scan or type the material code', '材料QR/コードを入力', '자재 코드 입력', 'Escanee o escriba el código', 'Scannez ou saisissez le code', 'Materialcode scannen/eingeben', 'Отсканируйте или введите код', 'Quét hoặc nhập mã vật tư', 'สแกนหรือพิมพ์รหัสวัสดุ'],
  ['扫物料码:物料存在才能填数量;数量可随意填,只要仓库数量足够', 'Scan a material code: quantity unlocks only for a known material; enter any quantity as long as stock suffices', '材料QRをスキャン:既知の材料のみ数量入力可。在庫が足りる範囲で自由入力', '자재 코드 스캔: 등록된 자재만 수량 입력 가능, 재고 내에서 자유롭게', 'Escanee un material: la cantidad se abre solo si existe; cualquier cantidad si hay stock', 'Scannez une matière : quantité débloquée si connue ; saisie libre selon stock', 'Material scannen: Menge nur bei bekanntem Material, frei im Rahmen des Bestands', 'Сканируйте материал: количество вводится при наличии, в пределах остатка', 'Quét vật tư: mở số lượng khi có, nhập tùy ý trong tồn kho', 'สแกนวัสดุ: ใส่จำนวนได้เมื่อมีวัสดุ ภายในจำนวนคงเหลือ'],
  ['BOM用量', 'BOM qty', 'BOM所要量', 'BOM 소요량', 'Cant. BOM', 'Qté BOM', 'BOM-Menge', 'Кол-во по BOM', 'SL BOM', 'จำนวน BOM'],
  ['BOM', 'BOM', 'BOM', 'BOM', 'BOM', 'BOM', 'BOM', 'BOM', 'BOM', 'BOM'],
  ['可用总量', 'Total available', '利用可能合計', '사용 가능 합계', 'Total disponible', 'Total disponible', 'Verfügbar gesamt', 'Всего доступно', 'Tổng khả dụng', 'รวมที่ใช้ได้'],
  ['最多可退', 'Max returnable', '返却可能上限', '최대 반납 가능', 'Máx. devolvable', 'Retour max.', 'Max. rückgebbar', 'Макс. к возврату', 'Trả tối đa', 'คืนได้สูงสุด'],
  ['领用数量', 'Pick quantity', '払出数量', '출고 수량', 'Cantidad a retirar', 'Quantité à prélever', 'Entnahmemenge', 'Кол-во выдачи', 'Số lượng xuất', 'จำนวนเบิก'],
  ['退料数量', 'Return quantity', '返却数量', '반납 수량', 'Cantidad a devolver', 'Quantité retournée', 'Rückgabemenge', 'Кол-во возврата', 'Số lượng trả', 'จำนวนคืน'],
  ['写入', 'Save', '登録', '저장', 'Guardar', 'Enregistrer', 'Speichern', 'Сохранить', 'Lưu', 'บันทึก'],
  ['写入数量失败', 'Failed to save quantity', '数量登録に失敗', '수량 저장 실패', 'Error al guardar cantidad', 'Échec d\'enregistrement', 'Menge speichern fehlgeschlagen', 'Не удалось сохранить количество', 'Lưu số lượng thất bại', 'บันทึกจำนวนไม่สำเร็จ'],
  ['加载单据失败', 'Failed to load the slip', '伝票読込に失敗', '전표 로드 실패', 'Error al cargar el vale', 'Échec de chargement', 'Beleg laden fehlgeschlagen', 'Не удалось загрузить документ', 'Tải phiếu thất bại', 'โหลดเอกสารไม่สำเร็จ'],
  ['查询物料失败', 'Material lookup failed', '材料照会に失敗', '자재 조회 실패', 'Error al buscar material', 'Recherche matière échouée', 'Materialabfrage fehlgeschlagen', 'Ошибка запроса материала', 'Tra cứu vật tư thất bại', 'ค้นหาวัสดุไม่สำเร็จ'],
  ['查询失败', 'Query failed', '照会に失敗', '조회 실패', 'Error de consulta', 'Échec de requête', 'Abfrage fehlgeschlagen', 'Ошибка запроса', 'Truy vấn thất bại', 'ค้นหาไม่สำเร็จ'],
  ['没有指定单据:请从生产领料列表点进来', 'No slip specified: open it from the picking list', '伝票未指定:払出一覧から開いてください', '전표 미지정: 출고 목록에서 여세요', 'Sin vale: ábralo desde la lista', 'Aucun bon : ouvrez depuis la liste', 'Kein Beleg: aus der Liste öffnen', 'Документ не указан: откройте из списка', 'Chưa chọn phiếu: mở từ danh sách', 'ไม่ได้ระบุเอกสาร: เปิดจากรายการ'],
  ['领料单', 'Picking slip', '払出伝票', '출고전표', 'Vale de retirada', 'Bon de prélèvement', 'Entnahmeschein', 'Накладная выдачи', 'Phiếu xuất', 'ใบเบิก'],
  ['退料单', 'Return slip', '返却伝票', '반납전표', 'Vale de devolución', 'Bon de retour', 'Rückgabeschein', 'Накладная возврата', 'Phiếu trả', 'ใบคืน'],
  ['领料单号', 'Picking no.', '払出番号', '출고번호', 'Nº retirada', 'N° prélèvement', 'Entnahme-Nr.', '№ выдачи', 'Số xuất', 'เลขใบเบิก'],
  ['退料单号', 'Return no.', '返却番号', '반납번호', 'Nº devolución', 'N° retour', 'Rückgabe-Nr.', '№ возврата', 'Số trả', 'เลขใบคืน'],
  ['领料明细', 'Picking lines', '払出明細', '출고 명세', 'Líneas de retirada', 'Lignes de prélèvement', 'Entnahmepositionen', 'Строки выдачи', 'Chi tiết xuất', 'รายการเบิก'],
  ['退料明细', 'Return lines', '返却明細', '반납 명세', 'Líneas de devolución', 'Lignes de retour', 'Rückgabepositionen', 'Строки возврата', 'Chi tiết trả', 'รายการคืน'],
  ['领料进度', 'Picking progress', '払出進捗', '출고 진행', 'Progreso de retirada', 'Avancement', 'Entnahmefortschritt', 'Прогресс выдачи', 'Tiến độ xuất', 'ความคืบหน้าการเบิก'],
  ['没有明细', 'No lines', '明細なし', '명세 없음', 'Sin líneas', 'Aucune ligne', 'Keine Positionen', 'Нет строк', 'Không có chi tiết', 'ไม่มีรายการ'],
  ['全部明细已领完,可以提交', 'All lines picked — ready to submit', '全数払出済。提出できます', '전량 출고됨. 제출 가능', 'Todas las líneas retiradas — puede enviar', 'Toutes les lignes prélevées — soumettable', 'Alle Positionen entnommen — absendbar', 'Все строки выданы — можно отправить', 'Đã xuất hết — có thể gửi', 'เบิกครบแล้ว ส่งได้'],
  ['请先扫描或输入工单号', 'Scan or type the work-order no. first', '先に作業指示番号を入力してください', '먼저 작업지시 번호를 입력하세요', 'Escanee o escriba primero la OT', 'Scannez ou saisissez d\'abord l\'OF', 'Zuerst den Auftrag eingeben', 'Сначала введите заказ', 'Hãy nhập lệnh sản xuất trước', 'กรอกเลขใบสั่งก่อน'],
  ['请先扫描或输入物料编码', 'Scan or type the material code first', '先に材料コードを入力してください', '먼저 자재 코드를 입력하세요', 'Escanee o escriba primero el código', 'Scannez ou saisissez d\'abord le code', 'Zuerst den Materialcode eingeben', 'Сначала введите код материала', 'Hãy nhập mã vật tư trước', 'กรอกรหัสวัสดุก่อน'],
  ['这个码里没有工单号', 'This code has no work-order no.', 'このコードに作業指示番号がありません', '이 코드에 작업지시 번호가 없습니다', 'Este código no contiene OT', 'Ce code ne contient pas d\'OF', 'Kein Auftrag im Code', 'В коде нет номера заказа', 'Mã này không có lệnh sản xuất', 'รหัสนี้ไม่มีเลขใบสั่ง'],
  ['这个码里没有物料编码', 'This code has no material code', 'このコードに材料コードがありません', '이 코드에 자재 코드가 없습니다', 'Este código no contiene material', 'Ce code ne contient pas de matière', 'Kein Materialcode im Code', 'В коде нет кода материала', 'Mã này không có mã vật tư', 'รหัสนี้ไม่มีรหัสวัสดุ'],
  ['调不起相机,请改用输入框扫码枪或手工输入', 'Camera unavailable — use a scanner gun or type it in', 'カメラを起動できません。スキャナーか手入力で', '카메라를 열 수 없습니다. 스캐너/직접 입력', 'Cámara no disponible: use lector o teclee', 'Caméra indisponible : scannez ou saisissez', 'Kamera nicht verfügbar: Scanner/nur Tippen', 'Камера недоступна: сканер или ввод', 'Không mở được camera: dùng máy quét hoặc nhập', 'เปิดกล้องไม่ได้: ใช้เครื่องสแกนหรือพิมพ์'],
  ['当前不是先进先出,已写进明细备注', 'Not FIFO — noted on the line remark', '先入先出でないため明細備考に記録', 'FIFO 아님 — 명세 비고에 기록', 'No es FIFO: anotado en la línea', 'Pas FIFO : noté sur la ligne', 'Nicht FIFO — in der Position vermerkt', 'Не FIFO — отмечено в строке', 'Không FIFO — đã ghi chú', 'ไม่ใช่ FIFO — บันทึกในหมายเหตุ'],

  // ── 提交 ──
  ['提交转材料出库单', 'Submit as Material Issue', '材料出庫に転送', '자재 출고 전환', 'Enviar como salida de material', 'Transfert en sortie matière', 'Als Materialausgabe buchen', 'В материал-выдачу', 'Chuyển xuất vật tư', 'โอนเป็นใบจ่ายวัสดุ'],
  ['提交确认', 'Confirm submission', '提出確認', '제출 확인', 'Confirmar envío', 'Confirmer l\'envoi', 'Absenden bestätigen', 'Подтвердить отправку', 'Xác nhận gửi', 'ยืนยันการส่ง'],
  ['确定提交', 'Submit', '提出する', '제출', 'Enviar', 'Soumettre', 'Absenden', 'Отправить', 'Gửi', 'ส่ง'],
  ['取消', 'Cancel', 'キャンセル', '취소', 'Cancelar', 'Annuler', 'Abbrechen', 'Отмена', 'Hủy', 'ยกเลิก'],
  ['提交后领料单会审核过账成材料出库单。确定提交?', 'After submitting, the picking slip is approved and posted as a material issue. Continue?', '提出後、払出伝票は承認され材料出庫として計上されます。よろしいですか?', '제출 후 출고전표가 승인되어 자재 출고로 기표됩니다. 계속하시겠습니까?', 'Tras enviar, el vale se aprueba y contabiliza como salida. ¿Continuar?', 'Après soumission, le bon est validé et comptabilisé en sortie. Continuer ?', 'Nach dem Absenden wird der Beleg geprüft und als Materialausgabe gebucht. Fortfahren?', 'После отправки накладная будет утверждена и проведена. Продолжить?', 'Sau khi gửi, phiếu được duyệt và hạch toán. Tiếp tục?', 'หลังส่ง ใบเบิกจะถูกอนุมัติและบันทึกเป็นใบจ่ายวัสดุ ดำเนินการต่อ?'],
  ['提交后领料单会审核过账成材料出库单;本次没有退料,那张退料单会一起作废(不产生其他入库单)。确定提交?', 'After submitting, the picking slip is approved and posted. No return this time, so the return slip is voided (no other-inbound created). Continue?', '提出後、払出伝票は承認・計上されます。今回は返却がないため返却伝票は作廢(入庫は発生しません)。よろしいですか?', '제출 후 출고전표가 승인됩니다. 이번 반납이 없어 반납전표는 작폐됩니다(기타입고 없음). 계속하시겠습니까?', 'Tras enviar, el vale se aprueba. Sin devolución, el vale de devolución se anula (sin entrada). ¿Continuar?', 'Après soumission, le bon est validé. Pas de retour : le bon de retour est annulé (aucune entrée). Continuer ?', 'Nach dem Absenden wird der Beleg geprüft. Keine Rückgabe, daher wird der Rückgabeschein storniert (kein Eingang). Fortfahren?', 'После отправки накладная будет проведена. Возврата нет — накладная возврата аннулируется. Продолжить?', 'Sau khi gửi, phiếu được duyệt. Không trả hàng nên phiếu trả bị hủy (không nhập kho). Tiếp tục?', 'หลังส่ง ใบเบิกจะถูกอนุมัติ ไม่มีการคืน ใบคืนจะถูกยกเลิก (ไม่มีการรับเข้า) ดำเนินการต่อ?'],
  ['提交失败', 'Submit failed', '提出に失敗', '제출 실패', 'Error al enviar', 'Échec de soumission', 'Absenden fehlgeschlagen', 'Ошибка отправки', 'Gửi thất bại', 'ส่งไม่สำเร็จ'],
  ['已提交', 'Submitted', '提出済み', '제출됨', 'Enviado', 'Soumis', 'Abgesendet', 'Отправлено', 'Đã gửi', 'ส่งแล้ว'],
  ['已提交:材料出库单已生成', 'Submitted: material issue created', '提出済み:材料出庫を作成しました', '제출됨: 자재 출고 생성', 'Enviado: salida de material creada', 'Soumis : sortie matière créée', 'Abgesendet: Materialausgabe erstellt', 'Отправлено: выдача сформирована', 'Đã gửi: đã tạo phiếu xuất', 'ส่งแล้ว: สร้างใบจ่ายวัสดุแล้ว'],
  ['退料默认 0', 'Returns default 0', '返却は既定0', '반납 기본 0', 'Devolución por defecto 0', 'Retour par défaut 0', 'Rückgabe Standard 0', 'Возврат по умолчанию 0', 'Trả mặc định 0', 'การคืนค่าเริ่มต้น 0'],
  ['退料默认数量为 0:不退料就不用管本页签,提交时这张退料单会一起作废,不产生其他入库单', 'Return quantity defaults to 0: skip this tab if you return nothing — the slip is voided on submit and no other-inbound is created', '返却数量は既定0。返却しない場合はこのタブを無視してよく、提出時に返却伝票は作廢されます(入庫は発生しません)', '반납 수량 기본 0: 반납이 없으면 이 탭은 그대로 두세요. 제출 시 반납전표는 작폐됩니다', 'La devolución es 0 por defecto: si no devuelve nada, ignore esta pestaña; al enviar se anula (sin entrada)', 'Retour à 0 par défaut : ignorez cet onglet sans retour ; le bon est annulé à la soumission', 'Rückgabemenge ist 0: ohne Rückgabe diesen Reiter ignorieren; beim Absenden wird der Schein storniert', 'Кол-во возврата по умолчанию 0: если возврата нет, оставьте вкладку; при отправке документ аннулируется', 'Số lượng trả mặc định 0: không trả thì bỏ qua tab này, khi gửi phiếu sẽ bị hủy', 'จำนวนคืนค่าเริ่มต้น 0: ถ้าไม่คืน ข้ามแท็บนี้ได้ เมื่อส่งใบจะถูกยกเลิก'],
  ['退料提交在领料页签', 'Return submission is on the picking tab', '返却の提出は払出タブで', '반납 제출은 출고 탭에서', 'La devolución se envía en la pestaña de retirada', 'L\'envoi du retour se fait dans l\'onglet prélèvement', 'Rückgabe wird im Entnahme-Reiter abgesendet', 'Возврат отправляется на вкладке выдачи', 'Gửi trả hàng ở tab xuất', 'ส่งคืนในแท็บเบิก'],

  // ── 打印 ──
  ['打印二维码', 'Print QR', 'QR印刷', 'QR 인쇄', 'Imprimir QR', 'Imprimer QR', 'QR drucken', 'Печать QR', 'In mã QR', 'พิมพ์ QR'],
  ['打印失败', 'Print failed', '印刷に失敗', '인쇄 실패', 'Error de impresión', 'Échec d\'impression', 'Druck fehlgeschlagen', 'Ошибка печати', 'In thất bại', 'พิมพ์ไม่สำเร็จ'],
  ['已发送到打印电脑', 'Sent to the print computer', '印刷PCへ送信しました', '인쇄 PC로 전송됨', 'Enviado al PC de impresión', 'Envoyé au PC d\'impression', 'An den Druck-PC gesendet', 'Отправлено на печать', 'Đã gửi tới máy in', 'ส่งไปยังเครื่องพิมพ์แล้ว'],
  ['在这台电脑上打开,手机打印时会自动出纸', 'Open this on the print computer; phone print jobs print here automatically', '印刷PCで開いておくと、スマホの印刷が自動で出紙されます', '인쇄 PC에서 열어 두면 휴대폰 인쇄가 자동 출력됩니다', 'Ábralo en el PC de impresión; los envíos del móvil se imprimen solos', 'Ouvrez-le sur le PC d\'impression ; l\'impression mobile se fait seule', 'Auf dem Druck-PC öffnen; Handy-Drucke kommen automatisch', 'Откройте на компьютере печати — печать с телефона пойдёт автоматически', 'Mở trên máy in; in từ điện thoại sẽ tự động', 'เปิดบนเครื่องพิมพ์ การพิมพ์จากมือถือจะออกอัตโนมัติ'],
  ['启用自动打印', 'Enable auto print', '自動印刷を有効化', '자동 인쇄 사용', 'Activar impresión automática', 'Activer l\'impression auto', 'Automatischen Druck aktivieren', 'Включить автопечать', 'Bật in tự động', 'เปิดพิมพ์อัตโนมัติ'],
  ['打开后,手机端点打印会发到这台电脑', 'When on, print jobs from phones are sent to this computer', 'オンにすると、スマホの印刷がこのPCに送られます', '켜면 휴대폰 인쇄가 이 PC로 전송됩니다', 'Al activarlo, las impresiones se envían a este PC', 'Activé, les impressions arrivent sur ce PC', 'Wenn an, gehen Handy-Drucke an diesen PC', 'Если вкл., печать с телефона идёт на этот ПК', 'Khi bật, lệnh in gửi đến máy này', 'เมื่อเปิด การพิมพ์จากมือถือจะมาที่เครื่องนี้'],
  ['站点名称', 'Station name', 'ステーション名', '스테이션 이름', 'Nombre del puesto', 'Nom du poste', 'Stationsname', 'Имя станции', 'Tên trạm', 'ชื่อสถานี'],
  ['手机端看到的就是这个名字', 'This is the name shown on phones', 'スマホ側に表示される名前です', '휴대폰에 표시되는 이름', 'Es el nombre que ven los móviles', 'Nom affiché sur les téléphones', 'Dieser Name erscheint am Handy', 'Это имя видно на телефоне', 'Đây là tên hiển thị trên điện thoại', 'ชื่อนี้จะแสดงบนมือถือ'],
  ['例如:一车间打印点', 'e.g. Workshop 1 print point', '例:第1工場 印刷所', '예: 1공장 인쇄소', 'p. ej. Punto de impresión 1', 'ex. : poste d\'impression atelier 1', 'z. B. Druckstelle Halle 1', 'напр. точка печати цеха 1', 'vd: Điểm in xưởng 1', 'เช่น: จุดพิมพ์โรงงาน 1'],
  ['打印机', 'Printer', 'プリンター', '프린터', 'Impresora', 'Imprimante', 'Drucker', 'Принтер', 'Máy in', 'เครื่องพิมพ์'],
  ['本机配置,只在这台电脑生效', 'Local setting, applies to this computer only', 'このPCのみの設定です', '이 PC에만 적용되는 설정', 'Ajuste local, solo este PC', 'Réglage local à ce PC', 'Nur für diesen PC', 'Только для этого ПК', 'Chỉ áp dụng máy này', 'ตั้งค่าเฉพาะเครื่องนี้'],
  ['留空 = 系统默认打印机', 'Empty = system default printer', '空欄=既定プリンター', '비우면 시스템 기본 프린터', 'Vacío = impresora predeterminada', 'Vide = imprimante par défaut', 'Leer = Standarddrucker', 'Пусто = принтер по умолчанию', 'Trống = máy in mặc định', 'ว่าง = เครื่องพิมพ์เริ่มต้น'],
  ['连接状态', 'Connection status', '接続状態', '연결 상태', 'Estado de conexión', 'État de connexion', 'Verbindungsstatus', 'Состояние связи', 'Trạng thái kết nối', 'สถานะการเชื่อมต่อ'],
  ['队列待打印', 'Queued jobs', '印刷待ちキュー', '대기 인쇄 작업', 'Trabajos en cola', 'Jobs en file', 'Wartende Aufträge', 'Заданий в очереди', 'Lệnh chờ in', 'งานในคิว'],
  ['最近心跳', 'Last heartbeat', '最終ハートビート', '최근 하트비트', 'Último latido', 'Dernier battement', 'Letzter Herzschlag', 'Последний отклик', 'Nhịp tim gần nhất', 'สัญญาณล่าสุด'],
  ['打印代理', 'Print agent', '印刷エージェント', '인쇄 에이전트', 'Agente de impresión', 'Agent d\'impression', 'Druck-Agent', 'Агент печати', 'Ứng dụng in', 'เอเจนต์พิมพ์'],
  ['本地打印代理', 'Local Print Agent', 'ローカル印刷エージェント', '로컬 인쇄 에이전트', 'Agente de impresión local', 'Agent d\'impression local', 'Lokaler Druck-Agent', 'Локальный агент печати', 'Ứng dụng in cục bộ', 'เอเจนต์พิมพ์ในเครื่อง'],
  ['已连接', 'Connected', '接続済み', '연결됨', 'Conectado', 'Connecté', 'Verbunden', 'Подключено', 'Đã kết nối', 'เชื่อมต่อแล้ว'],
  ['未连接', 'Not connected', '未接続', '연결 안 됨', 'Sin conexión', 'Non connecté', 'Nicht verbunden', 'Не подключено', 'Chưa kết nối', 'ยังไม่เชื่อมต่อ'],
  ['打印中就绪', 'Ready to print', '印刷準備完了', '인쇄 준비됨', 'Listo para imprimir', 'Prêt à imprimer', 'Druckbereit', 'Готово к печати', 'Sẵn sàng in', 'พร้อมพิมพ์'],
  ['代理未连接', 'Agent not connected', 'エージェント未接続', '에이전트 연결 안 됨', 'Agente sin conexión', 'Agent non connecté', 'Agent nicht verbunden', 'Агент не подключён', 'Chưa kết nối ứng dụng in', 'เอเจนต์ยังไม่เชื่อมต่อ'],
  ['未启用', 'Disabled', '無効', '사용 안 함', 'Desactivado', 'Désactivé', 'Deaktiviert', 'Отключено', 'Chưa bật', 'ปิดอยู่'],
  ['浏览器标准打印一定会弹出打印对话框,做不到「零点击」。真正的自动出纸需要本机代理程序:', 'Browser printing always shows a print dialog — true zero-click printing needs a local agent:', 'ブラウザ印刷は必ずダイアログが出ます。完全自動はローカルエージェントが必要です:', '브라우저 인쇄는 항상 대화상자가 뜹니다. 완전 자동은 로컬 에이전트가 필요합니다:', 'La impresión del navegador siempre muestra un diálogo; el cero clics requiere un agente local:', 'L\'impression navigateur affiche toujours une boîte ; le zéro-clic exige un agent local :', 'Browserdruck zeigt immer einen Dialog; echtes Zero-Klick braucht einen lokalen Agenten:', 'Браузер всегда показывает диалог; для полной автоматизации нужен локальный агент:', 'In qua trình duyệt luôn hiện hộp thoại; in tự động cần ứng dụng in cục bộ:', 'การพิมพ์ผ่านเบราว์เซอร์จะมีไดอะล็อกเสมอ ต้องใช้เอเจนต์ในเครื่องสำหรับการพิมพ์อัตโนมัติ'],
  ['在这台电脑上运行 tools/printing/print-agent.ps1', 'Run tools/printing/print-agent.ps1 on this computer', 'このPCで tools/printing/print-agent.ps1 を実行', '이 PC에서 tools/printing/print-agent.ps1 실행', 'Ejecute tools/printing/print-agent.ps1 en este PC', 'Exécutez tools/printing/print-agent.ps1 sur ce PC', 'tools/printing/print-agent.ps1 auf diesem PC ausführen', 'Запустите tools/printing/print-agent.ps1 на этом ПК', 'Chạy tools/printing/print-agent.ps1 trên máy này', 'รัน tools/printing/print-agent.ps1 บนเครื่องนี้'],
  ['用 -Install 参数跑一次即可设为开机自启(需管理员)', 'Run once with -Install to auto-start at boot (admin)', '-Install を一度実行で自動起動(管理者権限)', '-Install으로 한 번 실행하면 자동 시작(관리자)', 'Ejecute una vez con -Install para autoinicio (admin)', 'Exécutez une fois avec -Install pour l\'autostart (admin)', 'Einmal mit -Install starten für Autostart (Admin)', 'Запустите один раз с -Install для автозапуска (админ)', 'Chạy một lần với -Install để tự khởi động (admin)', 'รันด้วย -Install หนึ่งครั้งเพื่อเริ่มอัตโนมัติ (ผู้ดูแล)'],
  ['开着本页,代理连上后状态会变成「已连接」', 'Keep this page open; once the agent connects it shows "Connected"', 'このページを開いておくと、エージェント接続後に「接続済み」になります', '이 페이지를 열어 두면 에이전트 연결 후 "연결됨"으로 바뀝니다', 'Deje esta página abierta; al conectar el agente mostrará "Conectado"', 'Laissez cette page ouverte ; une fois l\'agent connecté, "Connecté"', 'Seite offen lassen; nach Verbindung erscheint „Verbunden"', 'Оставьте страницу открытой — после подключения будет «Подключено»', 'Mở trang này; khi ứng dụng in kết nối sẽ hiện "Đã kết nối"', 'เปิดหน้านี้ไว้ เมื่อเอเจนต์เชื่อมต่อจะแสดง "เชื่อมต่อแล้ว"'],
  ['没有代理时,打印会降级为浏览器打印(需要人点一次对话框)。', 'Without the agent, printing falls back to browser print (a dialog must be clicked).', 'エージェントがない場合はブラウザ印刷に切り替わります(ダイアログ操作が必要)。', '에이전트가 없으면 브라우저 인쇄로 전환됩니다(대화상자 클릭 필요).', 'Sin agente, se usa la impresión del navegador (hay que pulsar el diálogo).', 'Sans agent, impression navigateur (dialogue à valider).', 'Ohne Agenten: Browserdruck (Dialog bestätigen).', 'Без агента — печать из браузера (нужно подтвердить).', 'Không có ứng dụng in sẽ dùng in trình duyệt (phải bấm hộp thoại).', 'ถ้าไม่มีเอเจนต์จะพิมพ์ผ่านเบราว์เซอร์ (ต้องกดไดอะล็อก)'],
  ['打印代理出错,已降级为浏览器打印', 'Print agent error — fell back to browser printing', '印刷エージェント異常。ブラウザ印刷に切替', '인쇄 에이전트 오류 — 브라우저 인쇄로 전환', 'Error del agente: se usa impresión del navegador', 'Erreur de l\'agent : impression navigateur', 'Agentfehler — Browserdruck aktiv', 'Ошибка агента — печать из браузера', 'Lỗi ứng dụng in — dùng in trình duyệt', 'เอเจนต์ผิดพลาด — ใช้พิมพ์ผ่านเบราว์เซอร์'],
  ['代理未连接:有 1 张单要打印', 'Agent not connected: 1 document waiting to print', 'エージェント未接続:印刷待ち1件', '에이전트 연결 안 됨: 인쇄 대기 1건', 'Agente sin conexión: 1 documento por imprimir', 'Agent non connecté : 1 document à imprimer', 'Agent nicht verbunden: 1 Beleg zu drucken', 'Агент не подключён: 1 документ в очереди', 'Chưa kết nối: 1 phiếu chờ in', 'เอเจนต์ยังไม่เชื่อมต่อ: มี 1 เอกสารรอพิมพ์'],
  ['用浏览器打印', 'Print via browser', 'ブラウザで印刷', '브라우저로 인쇄', 'Imprimir con el navegador', 'Imprimer via le navigateur', 'Über Browser drucken', 'Печать из браузера', 'In bằng trình duyệt', 'พิมพ์ผ่านเบราว์เซอร์'],
  ['忽略', 'Ignore', '無視', '무시', 'Ignorar', 'Ignorer', 'Ignorieren', 'Пропустить', 'Bỏ qua', 'ข้าม'],
  ['最近出纸', 'Recent prints', '最近の印刷', '최근 인쇄', 'Impresiones recientes', 'Impressions récentes', 'Letzte Drucke', 'Последние печати', 'Lần in gần đây', 'พิมพ์ล่าสุด'],
  ['还没有打印记录', 'No print records yet', '印刷履歴はまだありません', '인쇄 기록 없음', 'Aún no hay registros', 'Aucun historique', 'Noch keine Drucke', 'Записей печати пока нет', 'Chưa có lịch sử in', 'ยังไม่มีประวัติการพิมพ์'],
  ['已保存到本机', 'Saved on this computer', 'このPCに保存しました', '이 PC에 저장됨', 'Guardado en este PC', 'Enregistré sur ce PC', 'Auf diesem PC gespeichert', 'Сохранено на этом ПК', 'Đã lưu trên máy này', 'บันทึกในเครื่องนี้แล้ว'],
  ['保存失败', 'Save failed', '保存に失敗', '저장 실패', 'Error al guardar', 'Échec d\'enregistrement', 'Speichern fehlgeschlagen', 'Ошибка сохранения', 'Lưu thất bại', 'บันทึกไม่สำเร็จ'],
  ['已开启自动打印', 'Auto print enabled', '自動印刷を有効にしました', '자동 인쇄 켬', 'Impresión automática activada', 'Impression auto activée', 'Automatischer Druck aktiviert', 'Автопечать включена', 'Đã bật in tự động', 'เปิดพิมพ์อัตโนมัติแล้ว'],
  ['已关闭自动打印', 'Auto print disabled', '自動印刷を無効にしました', '자동 인쇄 끔', 'Impresión automática desactivada', 'Impression auto désactivée', 'Automatischer Druck deaktiviert', 'Автопечать отключена', 'Đã tắt in tự động', 'ปิดพิมพ์อัตโนมัติแล้ว'],
  ['没有自动打印的权限:请联系管理员在组织架构里授权', 'No auto-print permission — ask an admin to grant it in the org settings', '自動印刷の権限がありません。管理者に許可を依頼してください', '자동 인쇄 권한이 없습니다. 관리자에게 요청하세요', 'Sin permiso de impresión automática: pida al administrador', 'Pas de droit d\'impression auto : demandez à un admin', 'Keine Auto-Druck-Berechtigung: Admin fragen', 'Нет прав на автопечать: обратитесь к администратору', 'Không có quyền in tự động: liên hệ quản trị', 'ไม่มีสิทธิ์พิมพ์อัตโนมัติ: ติดต่อผู้ดูแล'],

  // ── 2026-10-30 第二轮:「生成工单领料/退料单」独立成面板(开单工作台)──
  ['生成工单领料/退料单', 'Create Pick/Return Slips', '払出/返却伝票作成', '출고/반납 전표 생성', 'Crear vales de retirada/devolución', 'Créer bons de prélèvement/retour', 'Entnahme-/Rückgabescheine erstellen', 'Создать накладные выдачи/возврата', 'Tạo phiếu xuất/trả', 'สร้างใบเบิก/คืน'],
  ['扫工单生单 → 自动打印工单二维码', 'Scan work orders → create slips → auto-print QR', '指示QRスキャン→伝票作成→QR自動印刷', '지시 스캔 → 전표 생성 → QR 자동 인쇄', 'Escanear OT → crear vales → imprimir QR', 'Scanner OF → créer bons → imprimer QR', 'Auftrag scannen → Belege → QR drucken', 'Скан заказов → документы → печать QR', 'Quét lệnh → tạo phiếu → in QR', 'สแกนใบสั่ง → สร้างใบ → พิมพ์ QR'],
  ['扫工单', 'Scan Work Order', '指示QRスキャン', '작업지시 스캔', 'Escanear orden', 'Scanner l\'OF', 'Auftrag scannen', 'Сканировать заказ', 'Quét lệnh sản xuất', 'สแกนใบสั่งผลิต'],
  ['添加', 'Add', '追加', '추가', 'Añadir', 'Ajouter', 'Hinzufügen', 'Добавить', 'Thêm', 'เพิ่ม'],
  ['待生成', 'To create', '作成待ち', '생성 대기', 'Por crear', 'À créer', 'Zu erstellen', 'К созданию', 'Chờ tạo', 'รอสร้าง'],
  ['批量生成', 'Create all', '一括作成', '일괄 생성', 'Crear todo', 'Tout créer', 'Alle erstellen', 'Создать все', 'Tạo tất cả', 'สร้างทั้งหมด'],
  ['生成结果', 'Result', '作成結果', '생성 결과', 'Resultado', 'Résultat', 'Ergebnis', 'Результат', 'Kết quả', 'ผลลัพธ์'],
  ['全部失败', 'All failed', 'すべて失敗', '모두 실패', 'Todo falló', 'Tout a échoué', 'Alle fehlgeschlagen', 'Все с ошибкой', 'Tất cả thất bại', 'ล้มเหลวทั้งหมด'],
  ['已存在', 'Existed', '既存', '기존', 'Ya existe', 'Existant', 'Vorhanden', 'Уже есть', 'Đã có', 'มีอยู่แล้ว'],
  ['清空结果', 'Clear results', '結果をクリア', '결과 지우기', 'Limpiar resultados', 'Effacer les résultats', 'Ergebnisse löschen', 'Очистить результаты', 'Xóa kết quả', 'ล้างผลลัพธ์'],
  ['去生产领料', 'Go to picking', '払出へ', '출고로', 'Ir a retirada', 'Aller au prélèvement', 'Zur Entnahme', 'К выдаче', 'Đi xuất kho', 'ไปเบิก'],
  ['去生成领料/退料单', 'Go to create slips', '伝票作成へ', '전표 생성으로', 'Ir a crear vales', 'Créer les bons', 'Belege erstellen', 'Создать документы', 'Đi tạo phiếu', 'ไปสร้างใบ'],
  ['已生成的单', 'Created slips', '作成済み伝票', '생성된 전표', 'Vales creados', 'Bons créés', 'Erstellte Belege', 'Созданные документы', 'Phiếu đã tạo', 'ใบที่สร้างแล้ว'],
  ['这张工单已在待生成列表里', 'This work order is already in the queue', 'この指示は既に待ち行列にあります', '이 지시는 대기 목록에 있습니다', 'Esta OT ya está en la cola', 'Cet OF est déjà en file', 'Dieser Auftrag ist bereits in der Warteschlange', 'Этот заказ уже в очереди', 'Lệnh này đã có trong hàng đợi', 'ใบสั่งนี้อยู่ในคิวแล้ว'],
  ['生单在独立的工作台里做:可连续扫多张工单批量生成', 'Slips are created in a separate workbench: scan several work orders and create them in batch', '伝票作成は専用ワークベンチで行います。複数指示を連続スキャンして一括作成', '전표는 별도 작업대에서 생성합니다. 여러 지시를 연속 스캔해 일괄 생성', 'Los vales se crean en un banco aparte: escanee varias OT y créelas en lote', 'Les bons se créent dans un poste dédié : scannez plusieurs OF et créez-les en lot', 'Belege entstehen in einer eigenen Werkbank: mehrere Aufträge scannen und gesammelt erstellen', 'Документы создаются на отдельном рабочем месте: сканируйте несколько заказов и создавайте пакетом', 'Phiếu được tạo ở bàn làm việc riêng: quét nhiều lệnh và tạo hàng loạt', 'สร้างใบในหน้าจอแยก: สแกนหลายใบสั่งแล้วสร้างทีละชุด'],
  ['查询单据 → 扫码定位 → 扫码核销 → 全部领完提交', 'Query → scan to locate → scan to issue → submit when complete', '照会→QRで特定→材料スキャン→全数払出で提出', '조회 → 스캔 위치 → 스캔 불출 → 전량 후 제출', 'Consultar → ubicar → escanear → enviar', 'Consulter → localiser → scanner → soumettre', 'Abfragen → finden → scannen → abschließen', 'Запрос → найти → сканировать → отправить', 'Tra cứu → định vị → quét → gửi', 'ค้นหา → ระบุ → สแกน → ส่ง'],
  ['生成后自动打印工单二维码', 'Auto-print the work-order QR after creating', '作成後に指示QRを自動印刷', '생성 후 지시 QR 자동 인쇄', 'Imprimir el QR automáticamente tras crear', 'Imprimer le QR automatiquement après création', 'QR nach dem Erstellen automatisch drucken', 'Печатать QR автоматически после создания', 'Tự in mã QR sau khi tạo', 'พิมพ์ QR อัตโนมัติหลังสร้าง'],
  ['全部行', 'All lines', '全行', '전체 라인', 'Todas las líneas', 'Toutes les lignes', 'Alle Zeilen', 'Все строки', 'Tất cả dòng', 'ทุกบรรทัด'],

  // ── 2026-10-30 第三轮:退料改为「已完成领料单上按需退」──
  ['含退料', 'Has return', '返却あり', '반납 있음', 'Con devolución', 'Avec retour', 'Mit Rückgabe', 'С возвратом', 'Có trả hàng', 'มีการคืน'],
  ['开始退料', 'Start return', '返却を開始', '반납 시작', 'Iniciar devolución', 'Commencer le retour', 'Rückgabe starten', 'Начать возврат', 'Bắt đầu trả hàng', 'เริ่มคืนวัสดุ'],
  ['退出退料', 'Exit return', '返却をやめる', '반납 종료', 'Salir de devolución', 'Quitter le retour', 'Rückgabe beenden', 'Выйти из возврата', 'Thoát trả hàng', 'ออกจากการคืน'],
  ['退料模式', 'Return mode', '返却モード', '반납 모드', 'Modo devolución', 'Mode retour', 'Rückgabemodus', 'Режим возврата', 'Chế độ trả hàng', 'โหมดคืนวัสดุ'],
  ['扫物料码 · 退料', 'Scan material · Return', '材料スキャン·返却', '자재 스캔 · 반납', 'Escanear material · Devolución', 'Scanner matière · Retour', 'Material scannen · Rückgabe', 'Сканировать материал · Возврат', 'Quét vật tư · Trả hàng', 'สแกนวัสดุ · คืน'],
  ['扫物料码 · 领料', 'Scan material · Pick', '材料スキャン·払出', '자재 스캔 · 출고', 'Escanear material · Retirada', 'Scanner matière · Prélèvement', 'Material scannen · Entnahme', 'Сканировать материал · Выдача', 'Quét vật tư · Xuất', 'สแกนวัสดุ · เบิก'],
  ['本次可退', 'Returnable', '返却可能', '반납 가능', 'Devolvible', 'Retournable', 'Rückgabefähig', 'Можно вернуть', 'Có thể trả', 'คืนได้'],
  ['可退', 'Returnable', '返却可', '반납 가능', 'Devolvible', 'Retournable', 'Rückgabefähig', 'К возврату', 'Có thể trả', 'คืนได้'],
  ['提交退料', 'Submit return', '返却を提出', '반납 제출', 'Enviar devolución', 'Soumettre le retour', 'Rückgabe absenden', 'Отправить возврат', 'Gửi trả hàng', 'ส่งคืนวัสดุ'],
  ['退料确认', 'Confirm return', '返却確認', '반납 확인', 'Confirmar devolución', 'Confirmer le retour', 'Rückgabe bestätigen', 'Подтвердить возврат', 'Xác nhận trả hàng', 'ยืนยันการคืน'],
  ['确定退料', 'Confirm return', '返却する', '반납', 'Devolver', 'Retourner', 'Zurückgeben', 'Вернуть', 'Trả hàng', 'คืน'],
  ['退料成功', 'Return succeeded', '返却しました', '반납 완료', 'Devolución realizada', 'Retour effectué', 'Rückgabe erfolgt', 'Возврат выполнен', 'Trả hàng thành công', 'คืนสำเร็จ'],
  ['退料失败', 'Return failed', '返却に失敗', '반납 실패', 'Error en la devolución', 'Échec du retour', 'Rückgabe fehlgeschlagen', 'Ошибка возврата', 'Trả hàng thất bại', 'คืนไม่สำเร็จ'],
  ['将退', 'Returning', '返却する', '반납 예정', 'Devolver', 'Retour de', 'Zurückgeben', 'К возврату', 'Trả', 'คืน'],
  ['已记下', 'Recorded', '記録しました', '기록됨', 'Registrado', 'Enregistré', 'Erfasst', 'Записано', 'Đã ghi', 'บันทึกแล้ว'],
  ['退料', 'Return', '返却', '반납', 'Devolución', 'Retour', 'Rückgabe', 'Возврат', 'Trả hàng', 'คืนวัสดุ'],
  ['这张领料单已完成并过账。如需退料,点下面的按钮开始扫码退料。', 'This picking slip is completed and posted. To return material, tap the button below and start scanning.', 'この払出伝票は完了・計上済みです。返却する場合は下のボタンからスキャンを開始してください。', '이 출고전표는 완료·기표되었습니다. 반납하려면 아래 버튼으로 스캔을 시작하세요.', 'Este vale ya está completado y contabilizado. Para devolver material, pulse el botón y escanee.', 'Ce bon est terminé et comptabilisé. Pour retourner, utilisez le bouton et scannez.', 'Dieser Beleg ist abgeschlossen und gebucht. Zum Zurückgeben unten starten.', 'Накладная проведена. Для возврата нажмите кнопку ниже.', 'Phiếu đã hoàn thành và hạch toán. Để trả hàng, nhấn nút bên dưới.', 'ใบเบิกนี้เสร็จและบันทึกแล้ว หากต้องการคืน กดปุ่มด้านล่าง'],
  ['这张单已完成,可点「开始退料」', 'This slip is completed — tap "Start return"', '完了済みです。「返却を開始」を押してください', '완료되었습니다. "반납 시작"을 누르세요', 'Completado: pulse "Iniciar devolución"', 'Terminé : cliquez « Commencer le retour »', 'Abgeschlossen: „Rückgabe starten" tippen', 'Завершено: нажмите «Начать возврат»', 'Đã hoàn thành: nhấn "Bắt đầu trả hàng"', 'เสร็จแล้ว: กด "เริ่มคืนวัสดุ"'],
  ['扫物料码:只有这张单里有的物料才能退,数量按「已领 − 已退」限制', 'Scan a material code: only materials on this slip can be returned; quantity is limited to picked − returned', '材料QRをスキャン:この伝票の材料のみ返却可。数量は払出−返却で制限', '자재 코드 스캔: 이 전표의 자재만 반납 가능, 수량은 출고−반납', 'Escanee un material: solo los de este vale; límite = retirado − devuelto', 'Scannez une matière : seules celles du bon ; limite = prélevé − retourné', 'Material scannen: nur Belegpositionen; Grenze = entnommen − zurückgegeben', 'Сканируйте материал: только по этой накладной; лимит = выдано − возвращено', 'Quét vật tư: chỉ vật tư trong phiếu; giới hạn = đã xuất − đã trả', 'สแกนวัสดุ: เฉพาะในใบนี้ จำนวนจำกัดที่เบิก−คืน'],
  ['这个物料已经退完了', 'All of this material has been returned', 'この材料は返却済みです', '이 자재는 모두 반납되었습니다', 'Este material ya se devolvió por completo', 'Cette matière a déjà été entièrement retournée', 'Dieses Material wurde bereits vollständig zurückgegeben', 'Этот материал уже возвращён полностью', 'Vật tư này đã trả hết', 'วัสดุนี้คืนครบแล้ว'],
  ['选择要退的物料', 'Select materials to return', '返却する材料を選択', '반납할 자재 선택', 'Seleccione materiales a devolver', 'Sélectionnez les matières à retourner', 'Materialien zum Zurückgeben wählen', 'Выберите материалы к возврату', 'Chọn vật tư cần trả', 'เลือกวัสดุที่จะคืน'],
  ['项物料,合计', 'item(s), total', '件,合計', '건, 합계', 'ítem(s), total', 'ligne(s), total', 'Position(en), gesamt', 'поз., всего', 'mục, tổng', 'รายการ รวม'],
  ['提交后生成一张带「退料」标志的其他入库单并入库,库存会增加。确定提交?', 'This creates an other-inbound document tagged as a return and stocks in — inventory will increase. Continue?', '「返却」フラグ付きのその他入庫伝票が作成され、在庫が増えます。よろしいですか?', '"반납" 표시가 붙은 기타입고 전표가 생성되고 재고가 증가합니다. 계속하시겠습니까?', 'Se creará una entrada con la marca «devolución» y aumentará el stock. ¿Continuar?', 'Une entrée marquée « retour » sera créée et le stock augmentera. Continuer ?', 'Ein Eingang mit „Rückgabe" wird erstellt, der Bestand steigt. Fortfahren?', 'Будет создан приход с пометкой «возврат», остаток увеличится. Продолжить?', 'Sẽ tạo phiếu nhập có đánh dấu "trả hàng", tồn kho tăng. Tiếp tục?', 'จะสร้างใบรับเข้าที่มีเครื่องหมาย "คืน" และสต็อกจะเพิ่ม ดำเนินการต่อ?'],
  ['这张单还没提交完成,不能退料', 'This slip is not completed yet — cannot return', 'この伝票は未完了のため返却できません', '이 전표는 미완료라 반납할 수 없습니다', 'Este vale no está completado: no se puede devolver', 'Ce bon n\'est pas terminé : retour impossible', 'Beleg nicht abgeschlossen — keine Rückgabe', 'Накладная не завершена — возврат невозможен', 'Phiếu chưa hoàn thành — không trả được', 'ใบยังไม่เสร็จ คืนไม่ได้'],

  // ── 2026-10-30 第四轮:生单面板与领料面板彻底切干净 ──
  ['工单开单状态', 'Work-order status', '指示の伝票作成状況', '작업지시 전표 생성 상태', 'Estado de la orden', 'État des OF', 'Auftragsstatus', 'Статус заказов', 'Trạng thái lệnh', 'สถานะใบสั่ง'],
  ['只显示工单,单据请到「生产领料」查', 'Work orders only — see "Production Picking" for documents', '指示のみ表示。伝票は「払出」で確認', '작업지시만 표시. 전표는 "출고"에서', 'Solo órdenes; los vales en «Retirada»', 'OF uniquement ; bons dans « Prélèvement »', 'Nur Aufträge; Belege unter „Entnahme"', 'Только заказы; документы в «Выдаче»', 'Chỉ lệnh SX; phiếu xem ở "Xuất kho"', 'เฉพาะใบสั่ง เอกสารดูที่ "เบิก"'],
  ['工单号 / 产品名称', 'Work order / Product', '指示番号/製品名', '작업지시/품목명', 'OT / Producto', 'OF / Produit', 'Auftrag / Produkt', 'Заказ / Изделие', 'Lệnh / Sản phẩm', 'ใบสั่ง / ชื่อสินค้า'],
  ['未开单', 'Not created', '未作成', '미생성', 'Sin crear', 'Non créé', 'Nicht erstellt', 'Не создан', 'Chưa tạo', 'ยังไม่สร้าง'],
  ['已开单', 'Created', '作成済み', '생성됨', 'Creado', 'Créé', 'Erstellt', 'Создан', 'Đã tạo', 'สร้างแล้ว'],
  ['排产', 'Planned', '計画', '계획', 'Planificado', 'Planifié', 'Geplant', 'План', 'Kế hoạch', 'แผน'],
  ['刷新开单状态', 'Refresh status', '状況を更新', '상태 새로고침', 'Actualizar estado', 'Actualiser', 'Status aktualisieren', 'Обновить статус', 'Làm mới trạng thái', 'รีเฟรชสถานะ'],
  ['没有查到工单', 'No work orders found', '指示が見つかりません', '작업지시 없음', 'No se encontraron órdenes', 'Aucun OF trouvé', 'Keine Aufträge gefunden', 'Заказы не найдены', 'Không tìm thấy lệnh', 'ไม่พบใบสั่ง'],
]

const LOCALES = {
  en: 1, ja: 2, ko: 3, es: 4, fr: 5, de: 6, ru: 7, vi: 8, th: 9,
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

let totalAdded = 0
for (const [loc, idx] of Object.entries(LOCALES)) {
  const file = resolve(locDir, `${loc}.js`)
  const src = readFileSync(file, 'utf8')
  const missing = ROWS.filter((r) => !src.includes(`'${esc(r[0])}':`))
  if (!missing.length) {
    console.log(`[SKIP] ${loc}: 无缺失`)
    continue
  }
  if (!WRITE) {
    console.log(`[DRY]  ${loc}: 缺 ${missing.length} 条(例:${missing.slice(0, 3).map((m) => m[0]).join('、')})`)
    continue
  }
  // 插到 biz 对象末尾:找最后一个 "  },\n}" 形态太脆 —— 改成找 `const biz = {` 后的整块,
  // 在它的收尾 `\n  }` 之前插入(该文件 biz 是最后一个大对象,收尾就是 "  },\n}" 或 "  }\n}").
  // ⚠ 实测 en.js 结构与其它语言包一致(biz 在文件末尾),故用"最后一个 \n  }" 定位。
  const lines = missing.map((r) => {
    const val = r[idx]
    if (val == null || val === '') return null
    return `    '${esc(r[0])}': '${esc(val)}',`
  }).filter(Boolean)
  if (!lines.length) { console.log(`[SKIP] ${loc}: 无可插入行`); continue }

  const lastClose = src.lastIndexOf('\n  }')
  if (lastClose < 0) { console.error(`[FAIL] ${loc}: 找不到 biz 收尾,跳过`); continue }
  const out = src.slice(0, lastClose) + '\n' + lines.join('\n') + src.slice(lastClose)
  writeFileSync(file, out, 'utf8')
  totalAdded += lines.length
  console.log(`[OK]   ${loc}: +${lines.length} 条`)
}
if (WRITE) console.log(`\n合计新增 ${totalAdded} 条`)
