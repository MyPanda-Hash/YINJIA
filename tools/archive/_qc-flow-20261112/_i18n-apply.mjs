// _i18n-apply.mjs — 把「品质流程监控」新增 UI 词条写入各语言包 biz 块(2026-11-12)
// 用法: node tools/archive/_qc-flow-20261112/_i18n-apply.mjs [--dry]
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dry = process.argv.includes('--dry')

/** k: 中文原文(= 词条键,ADR-0001 数据键永远中文) */
const T = {
  '品质流程监控': ['Quality Process Monitor', '品質流程監控', '品質プロセス監視', '품질 프로세스 모니터', 'Monitor del proceso de calidad', 'Suivi du processus qualité', 'Qualitätsprozess-Monitor', 'Мониторинг процесса качества', 'Giám sát quy trình chất lượng', 'ตรวจสอบกระบวนการคุณภาพ'],
  '物料批号': ['Material lot no.', '物料批號', 'ロット番号', '로트 번호', 'Lote del material', 'N° de lot', 'Chargennummer', 'Номер партии', 'Số lô vật tư', 'เลขล็อตวัสดุ'],
  '物料批号与物料编码': ['Lot no. & item code', '物料批號與物料編碼', 'ロット番号と品目コード', '로트 번호와 품목 코드', 'Lote y código de material', 'Lot et code article', 'Charge und Artikelcode', 'Партия и код материала', 'Số lô và mã vật tư', 'เลขล็อตและรหัสวัสดุ'],
  '供应商与采购订单': ['Supplier & PO', '供應商與採購訂單', '仕入先と発注書', '공급업체 및 구매주문', 'Proveedor y pedido', 'Fournisseur et commande', 'Lieferant und Bestellung', 'Поставщик и заказ', 'Nhà cung cấp và đơn mua', 'ผู้ขายและใบสั่งซื้อ'],
  '搜索单号、物料编码、物料批号或供应商': ['Search no. / item code / lot no. / supplier', '搜尋單號、物料編碼、物料批號或供應商', '伝票番号・品目コード・ロット番号・仕入先で検索', '전표번호·품목코드·로트번호·공급업체 검색', 'Buscar n.º, código, lote o proveedor', 'Rechercher n°, code, lot ou fournisseur', 'Beleg-Nr., Artikelcode, Charge oder Lieferant suchen', 'Поиск по номеру, коду, партии или поставщику', 'Tìm số phiếu, mã vật tư, số lô hoặc nhà cung cấp', 'ค้นหาเลขที่ รหัสวัสดุ ล็อต หรือผู้ขาย'],
  '批次行数': ['Batch rows', '批次列數', 'ロット行数', '로트 행수', 'Filas de lote', 'Lignes de lot', 'Chargenzeilen', 'Строк партий', 'Số dòng lô', 'จำนวนแถวล็อต'],
  '停留': ['Dwell', '停留', '滞留', '체류', 'Permanencia', 'Attente', 'Verweildauer', 'Простой', 'Lưu lại', 'ค้างอยู่'],
  '停留天数': ['Dwell days', '停留天數', '滞留日数', '체류일수', 'Días en espera', "Jours d'attente", 'Tage', 'Дней в ожидании', 'Số ngày lưu', 'จำนวนวันที่ค้าง'],
  '天': ['d', '天', '日', '일', 'd', 'j', 'T', 'дн.', 'ngày', 'วัน'],
  '免检': ['Exempt', '免檢', '検査免除', '검사 면제', 'Exento', 'Exonéré', 'Prüfbefreit', 'Без контроля', 'Miễn kiểm', 'ยกเว้นการตรวจ'],
  '匹配方式': ['Match', '匹配方式', '照合方法', '매칭 방식', 'Coincidencia', 'Rapprochement', 'Zuordnung', 'Сопоставление', 'Cách khớp', 'วิธีจับคู่'],
  '检验单行': ['Inspection line', '檢驗單行', '検査明細行', '검사 명세 행', 'Línea de inspección', 'Ligne de contrôle', 'Prüfzeile', 'Строка контроля', 'Dòng phiếu kiểm', 'บรรทัดใบตรวจ'],
  '批号推定': ['Inferred by lot', '批號推定', 'ロット推定', '로트 추정', 'Estimado por lote', 'Déduit par lot', 'Über Charge zugeordnet', 'По партии (оценка)', 'Suy theo lô', 'ประเมินจากล็อต'],
  '实收': ['Received', '實收', '受入', '실수량', 'Recibido', 'Reçu', 'Erhalten', 'Принято', 'Thực nhận', 'รับจริง'],
  '送检': ['Submitted', '送檢', '送検', '제출', 'Enviado', 'Soumis', 'Eingereicht', 'Отправлено', 'Đã gửi', 'ส่งตรวจ'],
  '金蝶同步导入的采购入库单没有 MES 来源单号，只能按批号推定匹配；推不到就显示未生成': [
    'Purchase receipts synced from Kingdee carry no MES source number, so they can only be matched by lot no.; if no match, the step shows “Not created”',
    '金蝶同步匯入的採購入庫單沒有 MES 來源單號,只能按批號推定匹配;推不到就顯示未生成',
    'Kingdee から同期した入庫伝票には MES の参照番号がないため、ロット番号での推定照合のみ行います。照合できない場合は「未作成」と表示します',
    'Kingdee에서 동기화된 입고 전표에는 MES 참조 번호가 없어 로트 번호로만 추정 매칭합니다. 매칭되지 않으면 “미생성”으로 표시됩니다',
    'Las entradas sincronizadas de Kingdee no traen número de origen MES; solo se pueden cruzar por lote. Si no coincide, se muestra «No creado»',
    'Les entrées synchronisées depuis Kingdee n’ont pas de numéro source MES ; le rapprochement se fait par lot. Sans correspondance, l’étape affiche « Non créé »',
    'Aus Kingdee synchronisierte Eingangsbelege haben keine MES-Quellnummer; die Zuordnung erfolgt nur über die Charge. Ohne Treffer steht dort „Nicht erzeugt“',
    'Приходные ордера из Kingdee не содержат номера источника MES, поэтому сопоставление идёт только по партии. Если совпадения нет — «Не создано»',
    'Phiếu nhập kho đồng bộ từ Kingdee không có số nguồn MES nên chỉ khớp theo số lô. Không khớp sẽ hiển thị “Chưa tạo”',
    'ใบรับเข้าที่ซิงก์จาก Kingdee ไม่มีเลขที่อ้างอิง MES จึงจับคู่ได้ตามเลขล็อตเท่านั้น หากจับคู่ไม่ได้จะแสดง “ยังไม่สร้าง”',
  ],
  '需检验': ['Need inspection', '需檢驗', '要検査', '검사 필요', 'Requiere inspección', 'Contrôle requis', 'Prüfpflichtig', 'Требует контроля', 'Cần kiểm', 'ต้องตรวจ'],
  '仅需检验': ['Inspection required only', '僅需檢驗', '検査対象のみ', '검사 대상만', 'Solo requieren inspección', 'Contrôle requis uniquement', 'Nur prüfpflichtige', 'Только подлежащие контролю', 'Chỉ hàng cần kiểm', 'เฉพาะที่ต้องตรวจ'],
  '来料性质': ['Incoming type', '來料性質', '入荷区分', '입고 구분', 'Tipo de entrada', "Nature d'entrée", 'Eingangsart', 'Вид поступления', 'Tính chất nhập', 'ประเภทการรับเข้า'],
  '异常': ['Abnormal', '異常', '異常', '이상', 'Anomalía', 'Anomalie', 'Anomalie', 'Аномалия', 'Bất thường', 'ผิดปกติ'],
  '待检': ['To inspect', '待檢', '検査待ち', '검사 대기', 'Pendiente de inspección', 'En attente de contrôle', 'Wartet auf Prüfung', 'Ожидает контроля', 'Chờ kiểm', 'รอตรวจ'],
  '待入库': ['To put away', '待入庫', '入庫待ち', '입고 대기', 'Pendiente de entrada', "En attente d'entrée", 'Wartet auf Einlagerung', 'Ожидает прихода', 'Chờ nhập kho', 'รอรับเข้าคลัง'],
  '入库': ['Put-away', '入庫', '入庫', '입고', 'Entrada', 'Entrée', 'Einlagerung', 'Приход', 'Nhập kho', 'รับเข้าคลัง'],
  '合格数量': ['Pass qty', '合格數量', '合格数量', '합격 수량', 'Cantidad conforme', 'Qté conforme', 'Gutmenge', 'Кол-во годного', 'SL đạt', 'จำนวนผ่าน'],
  '不合格数量': ['Fail qty', '不合格數量', '不合格数量', '불량 수량', 'Cantidad no conforme', 'Qté non conforme', 'Fehlmenge', 'Кол-во брака', 'SL không đạt', 'จำนวนไม่ผ่าน'],
  '当前环节': ['Current step', '當前環節', '現在の工程', '현재 단계', 'Etapa actual', 'Étape en cours', 'Aktueller Schritt', 'Текущий этап', 'Bước hiện tại', 'ขั้นปัจจุบัน'],
  '未填批号': ['No lot no.', '未填批號', 'ロット未入力', '로트 미입력', 'Sin lote', 'Lot vide', 'Charge leer', 'Партия не указана', 'Chưa có số lô', 'ไม่มีเลขล็อต'],
  '未生成': ['Not created', '未生成', '未作成', '미생성', 'No creado', 'Non créé', 'Nicht erzeugt', 'Не создано', 'Chưa tạo', 'ยังไม่สร้าง'],
  '该物料免检，不需要来料检验': ['This item is inspection-exempt; no incoming inspection needed', '該物料免檢,不需要來料檢驗', 'この品目は検査免除のため、受入検査は不要です', '이 품목은 검사 면제이며 수입 검사가 필요하지 않습니다', 'Este material está exento de inspección', 'Cet article est exonéré de contrôle à réception', 'Dieser Artikel ist von der Eingangsprüfung befreit', 'Для этого материала входной контроль не требуется', 'Vật tư này miễn kiểm, không cần kiểm tra đầu vào', 'วัสดุนี้ยกเว้นการตรวจ ไม่ต้องตรวจรับเข้า'],
  '该环节还没有单据': ['No document at this step yet', '該環節還沒有單據', 'この工程にはまだ伝票がありません', '이 단계에는 아직 전표가 없습니다', 'Aún no hay documento en esta etapa', 'Aucun document à cette étape', 'In diesem Schritt gibt es noch keinen Beleg', 'На этом этапе документов пока нет', 'Bước này chưa có chứng từ', 'ขั้นนี้ยังไม่มีเอกสาร'],
  '点击跳转到': ['Click to open', '點擊跳轉到', 'クリックで移動', '클릭하여 이동', 'Clic para abrir', 'Cliquer pour ouvrir', 'Klicken zum Öffnen', 'Нажмите, чтобы открыть', 'Nhấn để mở', 'คลิกเพื่อเปิด'],
  '点节点跳转到对应单据；没有该面板权限时不可跳转': [
    'Click a node to open that document; requires permission for that panel',
    '點節點跳轉到對應單據;沒有該面板權限時不可跳轉',
    'ノードをクリックすると該当伝票へ移動します。パネル権限がない場合は移動できません',
    '노드를 클릭하면 해당 전표로 이동합니다. 패널 권한이 없으면 이동할 수 없습니다',
    'Haga clic en un nodo para abrir el documento; requiere permiso del panel',
    'Cliquez sur un nœud pour ouvrir le document ; nécessite le droit du panneau',
    'Klicken Sie auf einen Knoten, um den Beleg zu öffnen; Panel-Berechtigung erforderlich',
    'Нажмите на узел, чтобы открыть документ; нужны права на панель',
    'Nhấn vào nút để mở chứng từ tương ứng; cần quyền xem bảng đó',
    'คลิกที่โหนดเพื่อเปิดเอกสารที่เกี่ยวข้อง ต้องมีสิทธิ์ของแผงนั้น',
  ],
  '没有符合条件的批次': ['No matching batches', '沒有符合條件的批次', '条件に合うロットがありません', '조건에 맞는 로트가 없습니다', 'No hay lotes que coincidan', 'Aucun lot correspondant', 'Keine passenden Chargen', 'Нет подходящих партий', 'Không có lô phù hợp', 'ไม่มีล็อตที่ตรงเงื่อนไข'],
  '送料 → 检验 → 入库': ['Receipt → Inspection → Put-away', '送料 → 檢驗 → 入庫', '受入 → 検査 → 入庫', '자재입고 → 검사 → 창고입고', 'Recepción → Inspección → Entrada', 'Réception → Contrôle → Entrée', 'Wareneingang → Prüfung → Einlagerung', 'Приёмка → Контроль → Приход', 'Nhận hàng → Kiểm tra → Nhập kho', 'รับของ → ตรวจ → เข้าคลัง'],
  '绿=已审核/已完成': ['Green = Audited / Done', '綠=已審核/已完成', '緑=承認済/完了', '초록=승인/완료', 'Verde = Auditado/Completado', 'Vert = Validé/Terminé', 'Grün = Geprüft/Erledigt', 'Зелёный = Проверено/Готово', 'Xanh lá = Đã duyệt/Hoàn tất', 'เขียว=อนุมัติแล้ว/เสร็จสิ้น'],
  '蓝=待办': ['Blue = To do', '藍=待辦', '青=未処理', '파랑=대기', 'Azul = Pendiente', 'Bleu = À faire', 'Blau = Offen', 'Синий = К выполнению', 'Xanh dương = Cần làm', 'ฟ้า=รอดำเนินการ'],
  '橙=审批中': ['Orange = In approval', '橙=審批中', '橙=承認中', '주황=승인 중', 'Naranja = En aprobación', 'Orange = En approbation', 'Orange = In Genehmigung', 'Оранжевый = На согласовании', 'Cam = Đang duyệt', 'ส้ม=รออนุมัติ'],
  '红=作废/不合格': ['Red = Void / Failed', '紅=作廢/不合格', '赤=取消/不合格', '빨강=취소/부적합', 'Rojo = Anulado/No conforme', 'Rouge = Annulé/Non conforme', 'Rot = Storniert/Fehlerhaft', 'Красный = Отменено/Брак', 'Đỏ = Hủy/Không đạt', 'แดง=ยกเลิก/ไม่ผ่าน'],
  '无查看该面板的权限': ['No permission to view this panel', '無檢視該面板的權限', 'このパネルを表示する権限がありません', '이 패널을 볼 권한이 없습니다', 'Sin permiso para ver este panel', 'Aucun droit de voir ce panneau', 'Keine Berechtigung für dieses Panel', 'Нет прав на просмотр этой панели', 'Không có quyền xem bảng này', 'ไม่มีสิทธิ์ดูแผงนี้'],
}

const LOCALES = ['en', 'zh-TW', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'vi', 'th']

function quote(s) {
  return s.includes("'") ? `"${s.replace(/"/g, '\\"')}"` : `'${s}'`
}

const report = []
for (let i = 0; i < LOCALES.length; i++) {
  const loc = LOCALES[i]
  const file = path.join(root, 'frontend/src/i18n/locales', `${loc}.js`)
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  const at = lines.findIndex((l) => /^\s{2}biz:\s*\{\s*$/.test(l))
  if (at < 0) throw new Error(`${loc}.js 未找到 biz: { 锚点`)
  // 幂等:已存在该键就跳过
  const block = ['', '    // ---- 品质流程监控 QC_FLOW(2026-11-12:一条来料批次 × 送料/检验/入库 三单状态)----']
  let added = 0
  for (const [k, vals] of Object.entries(T)) {
    if (new RegExp(`(['"])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`).test(text)) continue
    block.push(`    ${quote(k)}: ${quote(vals[i])},`)
    added++
  }
  if (!added) { report.push(`${loc}: 已齐(跳过)`); continue }
  block.push('')
  lines.splice(at + 1, 0, ...block)
  if (!dry) fs.writeFileSync(file, lines.join('\n'), 'utf8')
  report.push(`${loc}: +${added} 条`)
}
console.log(report.join('\n'))
