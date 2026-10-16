import fs from 'node:fs'

/**
 * _i18n-first-insp-wo.mjs — 「取成型工艺清单按列合并 + 首件检验单选生产工单」这一批显示层词条,
 * 一次写进 10 个语言包(锚点 = 各语言包首件检验那批的「已按成型工艺清单」行)。
 *
 * 用户口径(2026-10-16 第四轮):
 *   「让当前取成型工艺清单的按钮实现的时候能够带入当前其对应列内填写的数据内容。然后去除当前首件
 *    检验单中检验项目/检验方案的按钮,然后让当前的首件检验单也可以选择到生产工单。当前制程检验单中
 *    存在实现方式,可以参照制程检验单的实现方式进行。」
 *
 * ⚠ 顺手把**制程检验单选生产工单**那批没落库的词条一起补上(它此前只靠机翻兜底):
 *   选生产工单 / 生成制程检验单失败 / 未生成…/ 该工单行已有…/ 已生成… / 生产工单行加载失败 /
 *   请先填写产品编码 —— 本批两条链路共用同一个弹窗,顺带补齐。
 */
const BLOCKS = {
  'zh-TW': {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': '已按成型工藝清單 {a}：新增 {b} 欄、刷新標準 {c} 欄、保留已填資料 {d} 格',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': '選擇一條生產工單行（工單號 + 工單行號唯一確定）生成首件檢驗單草稿（明細按成型工藝清單預鋪）；已建單的行會標出來，重複選擇不會重複建單。',
    '未生成首件检验单': '未生成首件檢驗單',
    '该工单行已有首件检验单': '該工單行已有首件檢驗單',
    '已生成首件检验单': '已生成首件檢驗單',
    '生成首件检验单失败': '生成首件檢驗單失敗',
    '选生产工单': '選生產工單',
    '生成制程检验单失败': '生成制程檢驗單失敗',
    '未生成制程检验单': '未生成制程檢驗單',
    '该工单行已有制程检验单': '該工單行已有制程檢驗單',
    '已生成制程检验单': '已生成制程檢驗單',
    '请先填写产品编码': '請先填寫產品編號',
    '生产工单行加载失败': '生產工單行載入失敗',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': '選擇一條生產工單行（工單號 + 工單行號唯一確定）生成制程檢驗單草稿；已建單的行會標出來，重複選擇不會重複建單。',
  },
  ja: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': '成形工程票 {a} より取込：{b} 列追加、標準 {c} 列更新、入力済 {d} セル保持',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': '生産指示行（指示書番号＋行番号で一意）を選択すると初品検査表の下書きを作成します（明細は成形工程票から展開）。既に作成済みの行は表示され、再選択しても重複作成しません。',
    '未生成首件检验单': '初品検査表を作成できませんでした',
    '该工单行已有首件检验单': 'この生産指示行には既に初品検査表があります',
    '已生成首件检验单': '初品検査表を作成しました',
    '生成首件检验单失败': '初品検査表の作成に失敗しました',
    '选生产工单': '生産指示を選択',
    '生成制程检验单失败': '製程検査表の作成に失敗しました',
    '未生成制程检验单': '製程検査表を作成できませんでした',
    '该工单行已有制程检验单': 'この生産指示行には既に製程検査表があります',
    '已生成制程检验单': '製程検査表を作成しました',
    '请先填写产品编码': '先に製品コードを入力してください',
    '生产工单行加载失败': '生産指示行の読み込みに失敗しました',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': '生産指示行（指示書番号＋行番号で一意）を選択すると製程検査表の下書きを作成します。既に作成済みの行は表示され、再選択しても重複作成しません。',
  },
  ko: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': '성형 공정표 {a}에서 반영: {b}개 열 추가, 표준 {c}개 열 갱신, 입력된 {d}칸 유지',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': '생산 작업지시 행(작업지시 번호 + 행 번호로 유일)을 선택하면 초품 검사표 초안이 생성됩니다(명세는 성형 공정표에서 미리 채움). 이미 생성된 행은 표시되며, 다시 선택해도 중복 생성되지 않습니다.',
    '未生成首件检验单': '초품 검사표가 생성되지 않았습니다',
    '该工单行已有首件检验单': '이 작업지시 행에는 이미 초품 검사표가 있습니다',
    '已生成首件检验单': '초품 검사표를 생성했습니다',
    '生成首件检验单失败': '초품 검사표 생성에 실패했습니다',
    '选生产工单': '생산 작업지시 선택',
    '生成制程检验单失败': '공정 검사표 생성에 실패했습니다',
    '未生成制程检验单': '공정 검사표가 생성되지 않았습니다',
    '该工单行已有制程检验单': '이 작업지시 행에는 이미 공정 검사표가 있습니다',
    '已生成制程检验单': '공정 검사표를 생성했습니다',
    '请先填写产品编码': '먼저 제품 코드를 입력하세요',
    '生产工单行加载失败': '생산 작업지시 행을 불러오지 못했습니다',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': '생산 작업지시 행(작업지시 번호 + 행 번호로 유일)을 선택하면 공정 검사표 초안이 생성됩니다. 이미 생성된 행은 표시되며, 다시 선택해도 중복 생성되지 않습니다.',
  },
  de: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'Aus Formprozessblatt {a} übernommen: {b} Spalte(n) neu, {c} Standard(s) aktualisiert, {d} eingegebene Zelle(n) erhalten',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'Wählen Sie eine Fertigungsauftragszeile (Auftragsnummer + Zeilennummer eindeutig): Es wird ein Entwurf des Erstmusterprüfblatts erstellt (Positionen aus dem Formprozessblatt vorbelegt); bereits vorhandene Zeilen sind markiert, erneute Auswahl erzeugt kein Duplikat.',
    '未生成首件检验单': 'Es wurde kein Erstmusterprüfblatt erstellt',
    '该工单行已有首件检验单': 'Für diese Auftragszeile gibt es bereits ein Erstmusterprüfblatt',
    '已生成首件检验单': 'Erstmusterprüfblatt erstellt',
    '生成首件检验单失败': 'Erstmusterprüfblatt konnte nicht erstellt werden',
    '选生产工单': 'Fertigungsauftrag wählen',
    '生成制程检验单失败': 'Prozessprüfblatt konnte nicht erstellt werden',
    '未生成制程检验单': 'Es wurde kein Prozessprüfblatt erstellt',
    '该工单行已有制程检验单': 'Für diese Auftragszeile gibt es bereits ein Prozessprüfblatt',
    '已生成制程检验单': 'Prozessprüfblatt erstellt',
    '请先填写产品编码': 'Bitte zuerst den Produktcode eingeben',
    '生产工单行加载失败': 'Fertigungsauftragszeilen konnten nicht geladen werden',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'Wählen Sie eine Fertigungsauftragszeile (Auftragsnummer + Zeilennummer eindeutig): Es wird ein Entwurf des Prozessprüfblatts erstellt; bereits vorhandene Zeilen sind markiert, erneute Auswahl erzeugt kein Duplikat.',
  },
  es: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'Desde la hoja de proceso de moldeo {a}: {b} columna(s) añadidas, {c} estándar(es) actualizados, {d} celda(s) introducidas conservadas',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'Elija una línea de orden de producción (n.º de orden + n.º de línea la identifican de forma única) para crear un borrador de hoja de inspección de primera pieza (el detalle se rellena desde la hoja de proceso de moldeo); las líneas que ya tienen hoja se marcan y volver a elegirlas no duplica.',
    '未生成首件检验单': 'No se creó la hoja de inspección de primera pieza',
    '该工单行已有首件检验单': 'Esta línea de orden ya tiene hoja de inspección de primera pieza',
    '已生成首件检验单': 'Hoja de inspección de primera pieza creada',
    '生成首件检验单失败': 'No se pudo crear la hoja de inspección de primera pieza',
    '选生产工单': 'Elegir orden de producción',
    '生成制程检验单失败': 'No se pudo crear la hoja de inspección de proceso',
    '未生成制程检验单': 'No se creó la hoja de inspección de proceso',
    '该工单行已有制程检验单': 'Esta línea de orden ya tiene hoja de inspección de proceso',
    '已生成制程检验单': 'Hoja de inspección de proceso creada',
    '请先填写产品编码': 'Introduzca primero el código de producto',
    '生产工单行加载失败': 'No se pudieron cargar las líneas de orden de producción',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'Elija una línea de orden de producción (n.º de orden + n.º de línea la identifican de forma única) para crear un borrador de hoja de inspección de proceso; las líneas que ya tienen hoja se marcan y volver a elegirlas no duplica.',
  },
  fr: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'Depuis la fiche de process de moulage {a} : {b} colonne(s) ajoutée(s), {c} standard(s) actualisé(s), {d} cellule(s) saisie(s) conservée(s)',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'Choisissez une ligne d’ordre de fabrication (n° d’ordre + n° de ligne l’identifient) pour créer un brouillon de fiche de contrôle de première pièce (le détail est prérempli depuis la fiche de process de moulage) ; les lignes déjà pourvues sont signalées, un nouveau choix ne crée pas de doublon.',
    '未生成首件检验单': 'Aucune fiche de contrôle de première pièce n’a été créée',
    '该工单行已有首件检验单': 'Cette ligne d’ordre a déjà une fiche de contrôle de première pièce',
    '已生成首件检验单': 'Fiche de contrôle de première pièce créée',
    '生成首件检验单失败': 'Échec de création de la fiche de contrôle de première pièce',
    '选生产工单': 'Choisir un ordre de fabrication',
    '生成制程检验单失败': 'Échec de création de la fiche de contrôle de process',
    '未生成制程检验单': 'Aucune fiche de contrôle de process n’a été créée',
    '该工单行已有制程检验单': 'Cette ligne d’ordre a déjà une fiche de contrôle de process',
    '已生成制程检验单': 'Fiche de contrôle de process créée',
    '请先填写产品编码': 'Saisissez d’abord le code produit',
    '生产工单行加载失败': 'Échec du chargement des lignes d’ordre de fabrication',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'Choisissez une ligne d’ordre de fabrication (n° d’ordre + n° de ligne l’identifient) pour créer un brouillon de fiche de contrôle de process ; les lignes déjà pourvues sont signalées, un nouveau choix ne crée pas de doublon.',
  },
  ru: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'Из листа техпроцесса формования {a}: добавлено столбцов — {b}, обновлено нормативов — {c}, сохранено заполненных ячеек — {d}',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'Выберите строку производственного заказа (номер заказа + номер строки однозначно определяют её) — будет создан черновик листа контроля первого изделия (спецификация предзаполняется из листа техпроцесса формования); строки с уже созданным листом помечены, повторный выбор не создаёт дубликат.',
    '未生成首件检验单': 'Лист контроля первого изделия не создан',
    '该工单行已有首件检验单': 'Для этой строки заказа уже есть лист контроля первого изделия',
    '已生成首件检验单': 'Лист контроля первого изделия создан',
    '生成首件检验单失败': 'Не удалось создать лист контроля первого изделия',
    '选生产工单': 'Выбрать производственный заказ',
    '生成制程检验单失败': 'Не удалось создать лист контроля процесса',
    '未生成制程检验单': 'Лист контроля процесса не создан',
    '该工单行已有制程检验单': 'Для этой строки заказа уже есть лист контроля процесса',
    '已生成制程检验单': 'Лист контроля процесса создан',
    '请先填写产品编码': 'Сначала введите код продукта',
    '生产工单行加载失败': 'Не удалось загрузить строки производственных заказов',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'Выберите строку производственного заказа (номер заказа + номер строки однозначно определяют её) — будет создан черновик листа контроля процесса; строки с уже созданным листом помечены, повторный выбор не создаёт дубликат.',
  },
  vi: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'Từ phiếu công nghệ tạo hình {a}: thêm {b} cột, cập nhật tiêu chuẩn {c} cột, giữ {d} ô đã nhập',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'Chọn một dòng lệnh sản xuất (số lệnh + số dòng xác định duy nhất) để tạo bản nháp phiếu kiểm tra chi tiết đầu tiên (chi tiết được điền sẵn từ phiếu công nghệ tạo hình); dòng đã có phiếu sẽ được đánh dấu, chọn lại không tạo trùng.',
    '未生成首件检验单': 'Chưa tạo phiếu kiểm tra chi tiết đầu tiên',
    '该工单行已有首件检验单': 'Dòng lệnh này đã có phiếu kiểm tra chi tiết đầu tiên',
    '已生成首件检验单': 'Đã tạo phiếu kiểm tra chi tiết đầu tiên',
    '生成首件检验单失败': 'Tạo phiếu kiểm tra chi tiết đầu tiên thất bại',
    '选生产工单': 'Chọn lệnh sản xuất',
    '生成制程检验单失败': 'Tạo phiếu kiểm tra công đoạn thất bại',
    '未生成制程检验单': 'Chưa tạo phiếu kiểm tra công đoạn',
    '该工单行已有制程检验单': 'Dòng lệnh này đã có phiếu kiểm tra công đoạn',
    '已生成制程检验单': 'Đã tạo phiếu kiểm tra công đoạn',
    '请先填写产品编码': 'Vui lòng nhập mã sản phẩm trước',
    '生产工单行加载失败': 'Tải dòng lệnh sản xuất thất bại',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'Chọn một dòng lệnh sản xuất (số lệnh + số dòng xác định duy nhất) để tạo bản nháp phiếu kiểm tra công đoạn; dòng đã có phiếu sẽ được đánh dấu, chọn lại không tạo trùng.',
  },
  th: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'นำเข้าจากใบกระบวนการขึ้นรูป {a}: เพิ่ม {b} คอลัมน์, อัปเดตมาตรฐาน {c} คอลัมน์, เก็บข้อมูลที่กรอกแล้ว {d} ช่อง',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'เลือกหนึ่งบรรทัดใบสั่งผลิต (เลขที่ใบสั่ง + ลำดับบรรทัดระบุได้ไม่ซ้ำ) เพื่อสร้างฉบับร่างใบตรวจสอบชิ้นแรก (รายละเอียดเติมจากใบกระบวนการขึ้นรูปให้); บรรทัดที่มีใบแล้วจะแสดงกำกับ เลือกซ้ำจะไม่สร้างซ้ำ',
    '未生成首件检验单': 'ยังไม่ได้สร้างใบตรวจสอบชิ้นแรก',
    '该工单行已有首件检验单': 'บรรทัดใบสั่งนี้มีใบตรวจสอบชิ้นแรกอยู่แล้ว',
    '已生成首件检验单': 'สร้างใบตรวจสอบชิ้นแรกแล้ว',
    '生成首件检验单失败': 'สร้างใบตรวจสอบชิ้นแรกไม่สำเร็จ',
    '选生产工单': 'เลือกใบสั่งผลิต',
    '生成制程检验单失败': 'สร้างใบตรวจสอบกระบวนการไม่สำเร็จ',
    '未生成制程检验单': 'ยังไม่ได้สร้างใบตรวจสอบกระบวนการ',
    '该工单行已有制程检验单': 'บรรทัดใบสั่งนี้มีใบตรวจสอบกระบวนการอยู่แล้ว',
    '已生成制程检验单': 'สร้างใบตรวจสอบกระบวนการแล้ว',
    '请先填写产品编码': 'กรุณากรอกรหัสผลิตภัณฑ์ก่อน',
    '生产工单行加载失败': 'โหลดบรรทัดใบสั่งผลิตไม่สำเร็จ',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'เลือกหนึ่งบรรทัดใบสั่งผลิต (เลขที่ใบสั่ง + ลำดับบรรทัดระบุได้ไม่ซ้ำ) เพื่อสร้างฉบับร่างใบตรวจสอบกระบวนการ; บรรทัดที่มีใบแล้วจะแสดงกำกับ เลือกซ้ำจะไม่สร้างซ้ำ',
  },
  en: {
    '已按成型工艺清单 {a}：新增 {b} 列、刷新标准 {c} 列、保留已填数据 {d} 格': 'From molding process sheet {a}: {b} column(s) added, {c} standard(s) refreshed, {d} entered cell(s) kept',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成首件检验单草稿（明细按成型工艺清单预铺）；已建单的行会标出来，重复选择不会重复建单。': 'Pick a production work-order line (work order no. + line no. uniquely identify it) to create a first-article inspection draft (details pre-filled from the molding process sheet); lines that already have a sheet are marked, re-picking will not create a duplicate.',
    '未生成首件检验单': 'No first-article inspection sheet was created',
    '该工单行已有首件检验单': 'This work-order line already has a first-article inspection sheet',
    '已生成首件检验单': 'First-article inspection sheet created',
    '生成首件检验单失败': 'Failed to create the first-article inspection sheet',
    '选生产工单': 'Pick production work order',
    '生成制程检验单失败': 'Failed to create the process inspection sheet',
    '未生成制程检验单': 'No process inspection sheet was created',
    '该工单行已有制程检验单': 'This work-order line already has a process inspection sheet',
    '已生成制程检验单': 'Process inspection sheet created',
    '请先填写产品编码': 'Please fill in the product code first',
    '生产工单行加载失败': 'Failed to load production work-order lines',
    '选择一条生产工单行（工单号 + 工单行号唯一确定）生成制程检验单草稿；已建单的行会标出来，重复选择不会重复建单。': 'Pick a production work-order line (work order no. + line no. uniquely identify it) to create a process inspection draft; lines that already have a sheet are marked, re-picking will not create a duplicate.',
  },
}

let files = 0
let keys = 0
for (const [loc, block] of Object.entries(BLOCKS)) {
  const p = `frontend/src/i18n/locales/${loc}.js`
  let s = fs.readFileSync(p, 'utf8')
  const anchor = '    "已按成型工艺清单":'
  const i = s.indexOf(anchor)
  if (i < 0) { console.log(`SKIP ${loc}: 锚点缺失`); continue }
  const add = Object.entries(block)
    .filter(([k]) => !s.includes(`${JSON.stringify(k)}:`))
    .map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n')
  if (!add) { console.log(`SKIP ${loc}: 已全部存在`); continue }
  s = s.slice(0, i) + add + '\n' + s.slice(i)
  fs.writeFileSync(p, s, 'utf8')
  console.log(`OK   ${loc}: +${add.split('\n').length} 条`)
  files++
  keys += add.split('\n').length
}
console.log(`\n共 ${files} 个语言包 / ${keys} 条词条`)
