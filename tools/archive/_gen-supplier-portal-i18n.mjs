/**
 * _gen-supplier-portal-i18n.mjs — 供应商门户(2026-10-24)词条批量追加器
 *
 * 背景:AGENTS.md《多语言强制规范》—— 新增面板/字段/UI 功能必须同时交付译名。
 * 本次新增:
 *   · 面板/菜单名:供应商门户 / 供应商采购打印 / 供应商权限配置
 *   · 供应商采购打印页文案(查询、明细、打印)
 *   · 供应商权限配置页文案(账号维护)
 *
 * 做法:按语言包 `biz` 字典**末尾追加**键值对,已存在的键**不覆盖**(人工校对优先)。
 * 重复执行安全(幂等)。
 *
 * 用法(仓库根目录):node tools/archive/_gen-supplier-portal-i18n.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const LOCALES = ['en', 'ja', 'zh-TW', 'ko', 'de', 'es', 'fr', 'ru', 'vi', 'th']

/** 中文键 → 各语言译文(顺序同 LOCALES) */
const TERMS = [
  // ---- 面板 / 菜单 / 权限 ----
  ['供应商门户', 'Supplier Portal', '仕入先ポータル', '供應商門戶', '공급업체 포털', 'Lieferantenportal', 'Portal de proveedores', 'Portail fournisseurs', 'Портал поставщиков', 'Cổng nhà cung cấp', 'พอร์ทัลผู้จัดจำหน่าย'],
  ['供应商采购打印', 'Supplier Purchase Print', '仕入先購買印刷', '供應商採購列印', '공급업체 구매 인쇄', 'Lieferanten-Einkaufsdruck', 'Impresión de compras de proveedores', 'Impression achats fournisseurs', 'Печать закупок поставщика', 'In phiếu mua hàng nhà cung cấp', 'พิมพ์ใบสั่งซื้อของผู้จัดจำหน่าย'],
  ['供应商权限配置', 'Supplier Permission Setup', '仕入先権限設定', '供應商權限設定', '공급업체 권한 설정', 'Lieferantenberechtigungen', 'Permisos de proveedores', 'Droits fournisseurs', 'Права поставщиков', 'Cấu hình quyền nhà cung cấp', 'ตั้งค่าสิทธิ์ผู้จัดจำหน่าย'],
  ['仅管理员', 'Administrators only', '管理者のみ', '僅管理員', '관리자 전용', 'Nur Administratoren', 'Solo administradores', 'Administrateurs uniquement', 'Только администратор', 'Chỉ quản trị viên', 'เฉพาะผู้ดูแลระบบ'],
  // 2026-10-25:「供应商权限配置」改为组织架构按角色授权,不再是管理员专属
  ['已授权', 'Authorized', '権限あり', '已授權', '권한 있음', 'Berechtigt', 'Autorizado', 'Autorisé', 'Есть права', 'Đã được cấp quyền', 'ได้รับสิทธิ์'],
  // 2026-10-25:账号弹窗「先选供应商 → 账号默认=供应商编码(可改)」+ 联系电话
  ['联系电话', 'Phone', '電話番号', '聯絡電話', '연락처', 'Telefon', 'Teléfono', 'Téléphone', 'Телефон', 'Điện thoại', 'โทรศัพท์'],
  ['如 13800000000 / 0752-5583930', 'e.g. 13800000000', '例:090-1234-5678', '如 13800000000', '예: 010-1234-5678', 'z. B. +49 170 1234567', 'p. ej. 600123456', 'ex. 06 12 34 56 78', 'напр. +7 900 123-45-67', 'vd. 0901234567', 'เช่น 0812345678'],
  ['选定供应商后,账号自动填该供应商编码,可手动修改;姓名默认取供应商名称。',
    'Once a supplier is selected the account defaults to its supplier code (editable); the name defaults to the supplier name.',
    '仕入先を選ぶとアカウントは仕入先コードが自動入力され(変更可)、氏名は仕入先名が既定値になります。',
    '選定供應商後,帳號自動填入該供應商編碼(可修改);姓名預設取供應商名稱。',
    '공급업체를 선택하면 계정에 해당 공급업체 코드가 자동 입력되며(수정 가능), 이름은 공급업체명이 기본값입니다.',
    'Nach Auswahl des Lieferanten wird das Konto mit dessen Code vorbelegt (änderbar); der Name kommt vom Lieferantennamen.',
    'Al elegir un proveedor, la cuenta se rellena con su código (editable); el nombre toma el del proveedor.',
    'Une fois le fournisseur choisi, le compte reprend son code (modifiable) ; le nom est celui du fournisseur.',
    'После выбора поставщика в аккаунт подставляется его код (можно изменить), имя берётся из наименования поставщика.',
    'Sau khi chọn nhà cung cấp, tài khoản tự điền mã nhà cung cấp (có thể sửa); họ tên lấy theo tên nhà cung cấp.',
    'เมื่อเลือกผู้จัดจำหน่าย บัญชีจะเติมรหัสผู้จัดจำหน่ายให้อัตโนมัติ (แก้ไขได้) และชื่อจะใช้ชื่อผู้จัดจำหน่าย'],
  ['默认=供应商编码,可修改(3~40 位字母/数字/下划线/点/横线)',
    'Defaults to the supplier code, editable (3–40 letters/digits/underscore/dot/hyphen)',
    '既定値=仕入先コード(変更可、英数字とアンダースコア・ドット・ハイフン 3~40 文字)',
    '預設=供應商編碼,可修改(3~40 位字母/數字/底線/點/橫線)',
    '기본값=공급업체 코드, 수정 가능 (영문/숫자/밑줄/점/하이픈 3~40자)',
    'Standard = Lieferantencode, änderbar (3–40 Zeichen)',
    'Por defecto = código de proveedor, editable (3–40 caracteres)',
    'Par défaut = code fournisseur, modifiable (3 à 40 caractères)',
    'По умолчанию = код поставщика, можно изменить (3–40 символов)',
    'Mặc định = mã nhà cung cấp, có thể sửa (3–40 ký tự)',
    'ค่าเริ่มต้น = รหัสผู้จัดจำหน่าย แก้ไขได้ (3–40 ตัวอักษร)'],
  ['已按供应商编码自动填写,可直接修改。', 'Filled from the supplier code — you can edit it.', '仕入先コードを自動入力しました。変更できます。', '已依供應商編碼自動填入,可直接修改。', '공급업체 코드로 자동 입력되었습니다. 수정할 수 있습니다.', 'Aus dem Lieferantencode vorbelegt – änderbar.', 'Rellenado con el código del proveedor; puede editarlo.', 'Pré-rempli avec le code fournisseur — modifiable.', 'Заполнено кодом поставщика — можно изменить.', 'Đã điền theo mã nhà cung cấp — có thể sửa.', 'เติมจากรหัสผู้จัดจำหน่ายแล้ว แก้ไขได้'],
  // 2026-10-25 第 4 轮:供应商改为**勾选弹窗**(与单据里「关联供应商」同一份档案),账号随勾选变化
  ['选择供应商', 'Select Supplier', '仕入先を選択', '選擇供應商', '공급업체 선택', 'Lieferant wählen', 'Seleccionar proveedor', 'Choisir un fournisseur', 'Выбрать поставщика', 'Chọn nhà cung cấp', 'เลือกผู้จัดจำหน่าย'],
  ['选择', 'Select', '選択', '選擇', '선택', 'Wählen', 'Seleccionar', 'Choisir', 'Выбрать', 'Chọn', 'เลือก'],
  ['确定', 'OK', 'OK', '確定', '확인', 'OK', 'Aceptar', 'Valider', 'ОК', 'Đồng ý', 'ตกลง'],
  ['点右侧「选择」勾选供应商', 'Click "Select" to pick a supplier', '右の「選択」から仕入先を選びます', '點右側「選擇」勾選供應商', '오른쪽 "선택"에서 공급업체를 고르세요', 'Rechts auf „Wählen" klicken', 'Pulse "Seleccionar" a la derecha', 'Cliquez sur « Choisir » à droite', 'Нажмите «Выбрать» справа', 'Bấm "Chọn" ở bên phải', 'กด "เลือก" ทางด้านขวา'],
  ['从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。',
    'Picked from the supplier master; the account then defaults to that supplier code (editable).',
    '仕入先マスタから選択します。選択後アカウントは仕入先コードが自動入力され(変更可)。',
    '從供應商檔案勾選;勾選後帳號自動填入該供應商編碼,可手動修改。',
    '공급업체 마스터에서 선택합니다. 선택 후 계정에 해당 코드가 자동 입력됩니다(수정 가능).',
    'Aus dem Lieferantenstamm wählen; das Konto wird dann mit dem Code vorbelegt (änderbar).',
    'Se elige del maestro de proveedores; la cuenta toma ese código (editable).',
    'Choisi dans la fiche fournisseur ; le compte reprend ensuite ce code (modifiable).',
    'Выбор из справочника поставщиков; в аккаунт подставляется его код (можно изменить).',
    'Chọn từ danh mục nhà cung cấp; tài khoản sẽ tự điền mã đó (có thể sửa).',
    'เลือกจากทะเบียนผู้จัดจำหน่าย แล้วบัญชีจะเติมรหัสนั้นให้ (แก้ไขได้)'],
  ['输入关键字过滤(编码/名称/联系人/电话)', 'Filter by code / name / contact / phone', 'コード・名称・担当・電話で絞り込み', '輸入關鍵字過濾(編碼/名稱/聯絡人/電話)', '코드/이름/담당자/전화로 필터', 'Nach Code/Name/Ansprechpartner/Telefon filtern', 'Filtrar por código/nombre/contacto/teléfono', 'Filtrer par code / nom / contact / téléphone', 'Фильтр по коду/названию/контакту/телефону', 'Lọc theo mã/tên/liên hệ/điện thoại', 'กรองตามรหัส/ชื่อ/ผู้ติดต่อ/โทรศัพท์'],
  ['供应商编码', 'Supplier Code', '仕入先コード', '供應商編碼', '공급업체 코드', 'Lieferantencode', 'Código de proveedor', 'Code fournisseur', 'Код поставщика', 'Mã nhà cung cấp', 'รหัสผู้จัดจำหน่าย'],
  ['供应商名称', 'Supplier Name', '仕入先名', '供應商名稱', '공급업체명', 'Lieferantenname', 'Nombre de proveedor', 'Nom du fournisseur', 'Наименование поставщика', 'Tên nhà cung cấp', 'ชื่อผู้จัดจำหน่าย'],
  ['联系人', 'Contact', '担当者', '聯絡人', '담당자', 'Ansprechpartner', 'Contacto', 'Contact', 'Контактное лицо', 'Người liên hệ', 'ผู้ติดต่อ'],
  ['电话', 'Phone', '電話', '電話', '전화', 'Telefon', 'Teléfono', 'Téléphone', 'Телефон', 'Điện thoại', 'โทรศัพท์'],
  ['地址', 'Address', '住所', '地址', '주소', 'Adresse', 'Dirección', 'Adresse', 'Адрес', 'Địa chỉ', 'ที่อยู่'],
  ['没有符合条件的供应商', 'No matching suppliers', '該当する仕入先がありません', '沒有符合條件的供應商', '조건에 맞는 공급업체가 없습니다', 'Keine passenden Lieferanten', 'No hay proveedores que coincidan', 'Aucun fournisseur correspondant', 'Нет подходящих поставщиков', 'Không có nhà cung cấp phù hợp', 'ไม่พบผู้จัดจำหน่ายที่ตรงเงื่อนไข'],
  ['请选择一个供应商', 'Please select a supplier', '仕入先を選択してください', '請選擇一個供應商', '공급업체를 선택하세요', 'Bitte einen Lieferanten wählen', 'Seleccione un proveedor', 'Veuillez choisir un fournisseur', 'Выберите поставщика', 'Vui lòng chọn nhà cung cấp', 'กรุณาเลือกผู้จัดจำหน่าย'],
  ['加载供应商档案失败', 'Failed to load supplier master', '仕入先マスタの読み込みに失敗しました', '載入供應商檔案失敗', '공급업체 마스터를 불러오지 못했습니다', 'Lieferantenstamm konnte nicht geladen werden', 'No se pudo cargar el maestro de proveedores', 'Échec du chargement de la fiche fournisseur', 'Не удалось загрузить справочник поставщиков', 'Không tải được danh mục nhà cung cấp', 'โหลดทะเบียนผู้จัดจำหน่ายไม่สำเร็จ'],
  ['加载中…', 'Loading…', '読み込み中…', '載入中…', '불러오는 중…', 'Wird geladen…', 'Cargando…', 'Chargement…', 'Загрузка…', 'Đang tải…', 'กำลังโหลด…'],
  ['共', 'Total', '全', '共', '총', 'Gesamt', 'Total', 'Total', 'Всего', 'Tổng', 'ทั้งหมด'],
  ['条', 'items', '件', '筆', '건', 'Einträge', 'registros', 'éléments', 'записей', 'bản ghi', 'รายการ'],
  ['配置供应商账号', 'Manage supplier accounts', '仕入先アカウント設定', '設定供應商帳號', '공급업체 계정 설정', 'Lieferantenkonten verwalten', 'Gestionar cuentas de proveedor', 'Gérer les comptes fournisseurs', 'Управление аккаунтами поставщиков', 'Quản lý tài khoản nhà cung cấp', 'จัดการบัญชีผู้จัดจำหน่าย'],
  ['没有该面板的权限', 'No permission for this panel', 'このパネルへの権限がありません', '沒有該面板的權限', '이 패널에 대한 권한이 없습니다', 'Keine Berechtigung für dieses Panel', 'Sin permiso para este panel', 'Pas de droit sur ce panneau', 'Нет прав на эту панель', 'Không có quyền với màn hình này', 'ไม่มีสิทธิ์ในหน้าจอนี้'],
  ['谁能进入本页:管理员,以及在「组织架构 → 角色与面板权限 → 智能供应链 → 供应商权限配置」勾了「配置供应商账号」的角色下的账号。',
    'Who can open this page: administrators, plus accounts whose role has “Manage supplier accounts” checked under Organization → Role & panel permissions → Smart Supply Chain → Supplier Permission Setup.',
    'このページを開けるのは管理者、および「組織 → ロールとパネル権限 → スマートサプライチェーン → 仕入先権限設定」で「仕入先アカウント設定」にチェックしたロールのアカウントです。',
    '誰能進入本頁:管理員,以及在「組織架構 → 角色與面板權限 → 智能供應鏈 → 供應商權限設定」勾選「設定供應商帳號」的角色所屬帳號。',
    '이 페이지를 열 수 있는 사용자: 관리자, 그리고 조직 → 역할 및 패널 권한 → 스마트 공급망 → 공급업체 권한 설정에서 공급업체 계정 설정을 체크한 역할의 계정.',
    'Zugriff haben Administratoren sowie Konten, deren Rolle unter Organisation → Rollen- und Panelrechte → Smart Supply Chain → Lieferantenberechtigungen „Lieferantenkonten verwalten“ angehakt hat.',
    'Pueden entrar administradores y las cuentas cuyo rol tenga marcado «Gestionar cuentas de proveedor» en Organización → Roles y permisos de panel → Cadena de suministro → Permisos de proveedores.',
    'Accès réservé aux administrateurs et aux comptes dont le rôle a « Gérer les comptes fournisseurs » coché dans Organisation → Rôles et droits des panneaux → Chaîne d’approvisionnement → Droits fournisseurs.',
    'Доступ имеют администраторы и аккаунты, у роли которых отмечено «Управление аккаунтами поставщиков» в разделе Организация → Роли и права на панели → Цепочка поставок → Права поставщиков.',
    'Người được vào trang này: quản trị viên và tài khoản thuộc vai trò đã chọn «Quản lý tài khoản nhà cung cấp» trong Tổ chức → Vai trò và quyền màn hình → Chuỗi cung ứng → Cấu hình quyền nhà cung cấp.',
    'ผู้ที่เข้าได้: ผู้ดูแลระบบ และบัญชีที่บทบาทถูกติ๊ก “จัดการบัญชีผู้จัดจำหน่าย” ใน องค์กร → บทบาทและสิทธิ์หน้าจอ → ห่วงโซ่อุปทานอัจฉริยะ → ตั้งค่าสิทธิ์ผู้จัดจำหน่าย'],
  ['供应商', 'Supplier', '仕入先', '供應商', '공급업체', 'Lieferant', 'Proveedor', 'Fournisseur', 'Поставщик', 'Nhà cung cấp', 'ผู้จัดจำหน่าย'],
  // ---- 打印页 ----
  ['供应商编码', 'Supplier Code', '仕入先コード', '供應商編碼', '공급업체 코드', 'Lieferantencode', 'Código de proveedor', 'Code fournisseur', 'Код поставщика', 'Mã nhà cung cấp', 'รหัสผู้จัดจำหน่าย'],
  ['只读:仅查看与打印本公司名下的采购订单', 'Read-only: view and print your own purchase orders only', '読み取り専用:自社の購買発注の閲覧・印刷のみ', '唯讀:僅檢視與列印本公司名下的採購訂單', '읽기 전용: 당사 명의의 구매 발주 조회·인쇄만 가능', 'Nur lesen: eigene Bestellungen ansehen und drucken', 'Solo lectura: ver e imprimir sus propios pedidos', 'Lecture seule : consulter et imprimer vos propres commandes', 'Только чтение: просмотр и печать своих заказов', 'Chỉ đọc: chỉ xem và in đơn mua hàng của đơn vị mình', 'อ่านเท่านั้น: ดูและพิมพ์ใบสั่งซื้อของบริษัทตนเอง'],
  ['搜索单据编号 / 物料编码 / 物料名称', 'Search doc no. / item code / item name', '伝票番号・品目コード・品名で検索', '搜尋單據編號 / 物料編碼 / 物料名稱', '문서번호/품목코드/품목명 검색', 'Belegnr. / Artikelnummer / Artikelname suchen', 'Buscar n.º de documento / código / nombre', 'Rechercher n° de pièce / code / désignation', 'Поиск: № документа / код / наименование', 'Tìm số chứng từ / mã vật tư / tên vật tư', 'ค้นหาเลขที่เอกสาร / รหัสสินค้า / ชื่อสินค้า'],
  ['单据日期起', 'Date from', '伝票日付(開始)', '單據日期起', '문서일자 시작', 'Belegdatum von', 'Fecha desde', 'Date du', 'Дата с', 'Ngày chứng từ từ', 'วันที่เอกสาร (เริ่ม)'],
  ['单据日期止', 'Date to', '伝票日付(終了)', '單據日期止', '문서일자 종료', 'Belegdatum bis', 'Fecha hasta', 'Date au', 'Дата по', 'Ngày chứng từ đến', 'วันที่เอกสาร (ถึง)'],
  ['只看未关闭', 'Unclosed only', '未完了のみ', '只看未關閉', '미종결만 보기', 'Nur offene', 'Solo no cerradas', 'Non clôturés uniquement', 'Только незакрытые', 'Chỉ đơn chưa đóng', 'เฉพาะที่ยังไม่ปิด'],
  ['共', 'Total', '合計', '共', '총', 'Gesamt', 'Total', 'Total', 'Всего', 'Tổng', 'ทั้งหมด'],
  ['张', 'orders', '件', '張', '건', 'Belege', 'pedidos', 'pièces', 'док.', 'đơn', 'รายการ'],
  // 「共 N 张」整句(量词位置随语言变,不能拆开拼;见 SupplierPrint.vue 的 countText)
  ['共 {n} 张', '{n} orders', '全 {n} 件', '共 {n} 張', '{n}건', 'Gesamt {n} Belege', '{n} pedidos', '{n} pièces', 'Всего: {n}', '{n} đơn', 'ทั้งหมด {n} รายการ'],
  ['没有符合条件的采购订单', 'No matching purchase orders', '該当する購買発注はありません', '沒有符合條件的採購訂單', '조건에 맞는 구매 발주가 없습니다', 'Keine passenden Bestellungen', 'No hay pedidos que coincidan', 'Aucune commande correspondante', 'Нет подходящих заказов', 'Không có đơn mua hàng phù hợp', 'ไม่มีใบสั่งซื้อที่ตรงเงื่อนไข'],
  ['查询采购订单失败', 'Failed to load purchase orders', '購買発注の取得に失敗しました', '查詢採購訂單失敗', '구매 발주 조회 실패', 'Bestellungen konnten nicht geladen werden', 'Error al cargar los pedidos', 'Échec du chargement des commandes', 'Не удалось загрузить заказы', 'Tải đơn mua hàng thất bại', 'โหลดใบสั่งซื้อไม่สำเร็จ'],
  ['读取订单明细失败', 'Failed to load order details', '発注明細の取得に失敗しました', '讀取訂單明細失敗', '발주 상세 조회 실패', 'Bestellpositionen konnten nicht geladen werden', 'Error al cargar el detalle del pedido', 'Échec du chargement du détail', 'Не удалось загрузить позиции заказа', 'Tải chi tiết đơn thất bại', 'โหลดรายละเอียดใบสั่งซื้อไม่สำเร็จ'],
  ['请先选择一张采购订单', 'Select a purchase order first', '先に購買発注を選択してください', '請先選擇一張採購訂單', '먼저 구매 발주를 선택하세요', 'Bitte zuerst eine Bestellung wählen', 'Seleccione primero un pedido', 'Sélectionnez d’abord une commande', 'Сначала выберите заказ', 'Vui lòng chọn một đơn mua hàng', 'กรุณาเลือกใบสั่งซื้อก่อน'],
  ['未取到单据数据', 'No document data', '伝票データを取得できません', '未取到單據資料', '문서 데이터를 가져오지 못했습니다', 'Keine Belegdaten erhalten', 'No se obtuvieron datos del documento', 'Aucune donnée de pièce', 'Нет данных документа', 'Không lấy được dữ liệu chứng từ', 'ไม่พบข้อมูลเอกสาร'],
  ['采购订单明细', 'Purchase Order Details', '購買発注明細', '採購訂單明細', '구매 발주 상세', 'Bestellpositionen', 'Detalle del pedido', 'Détail de la commande', 'Позиции заказа', 'Chi tiết đơn mua hàng', 'รายละเอียดใบสั่งซื้อ'],
  ['行数', 'Lines', '行数', '行數', '행수', 'Zeilen', 'Líneas', 'Lignes', 'Строк', 'Số dòng', 'จำนวนรายการ'],
  ['数量合计', 'Total Qty', '数量計', '數量合計', '수량 합계', 'Menge ges.', 'Cantidad total', 'Qté totale', 'Итого кол-во', 'Tổng số lượng', 'รวมจำนวน'],
  ['金额合计', 'Total Amount', '金額計', '金額合計', '금액 합계', 'Betrag ges.', 'Importe total', 'Montant total', 'Итого сумма', 'Tổng tiền', 'รวมยอดเงิน'],
  ['操作', 'Actions', '操作', '操作', '작업', 'Aktionen', 'Acciones', 'Actions', 'Действия', 'Thao tác', 'การดำเนินการ'],
  ['明细', 'Details', '明細', '明細', '상세', 'Details', 'Detalle', 'Détail', 'Детали', 'Chi tiết', 'รายละเอียด'],
  ['打印', 'Print', '印刷', '列印', '인쇄', 'Drucken', 'Imprimir', 'Imprimer', 'Печать', 'In', 'พิมพ์'],
  ['打印失败', 'Print failed', '印刷に失敗しました', '列印失敗', '인쇄 실패', 'Drucken fehlgeschlagen', 'Error de impresión', 'Échec de l’impression', 'Ошибка печати', 'In thất bại', 'พิมพ์ไม่สำเร็จ'],
  ['合计', 'Total', '合計', '合計', '합계', 'Summe', 'Total', 'Total', 'Итого', 'Tổng', 'รวม'],
  ['预计到货日期', 'Expected Arrival', '入荷予定日', '預計到貨日期', '입고 예정일', 'Geplantes Eintreffen', 'Llegada prevista', 'Arrivée prévue', 'Ожидаемое поступление', 'Ngày dự kiến đến', 'วันที่คาดว่าจะรับ'],
  ['未知', 'Unknown', '不明', '未知', '알 수 없음', 'Unbekannt', 'Desconocido', 'Inconnu', 'Неизвестно', 'Không rõ', 'ไม่ทราบ'],
  ['当前账号不是供应商账号,无法使用供应商采购打印', 'This account is not a supplier account and cannot use Supplier Purchase Print', 'このアカウントは仕入先アカウントではないため、仕入先購買印刷を使用できません', '目前帳號不是供應商帳號,無法使用供應商採購列印', '이 계정은 공급업체 계정이 아니어서 사용할 수 없습니다', 'Dieses Konto ist kein Lieferantenkonto', 'Esta cuenta no es de proveedor', 'Ce compte n’est pas un compte fournisseur', 'Этот аккаунт не является аккаунтом поставщика', 'Tài khoản này không phải tài khoản nhà cung cấp', 'บัญชีนี้ไม่ใช่บัญชีผู้จัดจำหน่าย'],
  // ---- 供应商门户顶栏 ----
  ['账号信息', 'Account Info', 'アカウント情報', '帳號資訊', '계정 정보', 'Kontoinformation', 'Información de cuenta', 'Informations du compte', 'Данные аккаунта', 'Thông tin tài khoản', 'ข้อมูลบัญชี'],
  ['退出登录', 'Sign out', 'ログアウト', '登出', '로그아웃', 'Abmelden', 'Cerrar sesión', 'Se déconnecter', 'Выйти', 'Đăng xuất', 'ออกจากระบบ'],
  ['本账号仅可使用「供应商采购打印」:只能查看和打印本公司名下的采购订单。', 'This account can only use Supplier Purchase Print: view and print your own purchase orders.', 'このアカウントは「仕入先購買印刷」のみ使用できます。自社の購買発注の閲覧・印刷のみ可能です。', '本帳號僅可使用「供應商採購列印」:只能檢視與列印本公司名下的採購訂單。', '이 계정은 공급업체 구매 인쇄만 사용할 수 있습니다.', 'Dieses Konto kann nur Lieferanten-Einkaufsdruck nutzen.', 'Esta cuenta solo puede usar Impresión de compras de proveedores.', 'Ce compte n’accède qu’à Impression achats fournisseurs.', 'Этот аккаунт может использовать только печать закупок.', 'Tài khoản này chỉ dùng được In phiếu mua hàng nhà cung cấp.', 'บัญชีนี้ใช้ได้เฉพาะพิมพ์ใบสั่งซื้อของผู้จัดจำหน่าย'],
  ['请填写完整', 'Please fill in all fields', 'すべて入力してください', '請填寫完整', '모두 입력하세요', 'Bitte alles ausfüllen', 'Complete todos los campos', 'Veuillez tout remplir', 'Заполните все поля', 'Vui lòng nhập đầy đủ', 'กรุณากรอกให้ครบ'],
  ['新密码至少 6 位', 'New password must be at least 6 characters', '新しいパスワードは6文字以上', '新密碼至少 6 位', '새 비밀번호는 6자 이상', 'Neues Passwort mindestens 6 Zeichen', 'La nueva contraseña debe tener al menos 6 caracteres', 'Le nouveau mot de passe doit contenir au moins 6 caractères', 'Новый пароль не короче 6 символов', 'Mật khẩu mới tối thiểu 6 ký tự', 'รหัสผ่าน新しいอย่างน้อย 6 ตัวอักษร'],
  ['两次输入的新密码不一致', 'The two passwords do not match', '新しいパスワードが一致しません', '兩次輸入的新密碼不一致', '새 비밀번호가 일치하지 않습니다', 'Die Passwörter stimmen nicht überein', 'Las contraseñas no coinciden', 'Les mots de passe ne correspondent pas', 'Пароли не совпадают', 'Mật khẩu nhập lại không khớp', 'รหัสผ่านทั้งสองไม่ตรงกัน'],
  ['密码修改成功，请用新密码重新登录', 'Password changed, please sign in again', 'パスワードを変更しました。再ログインしてください', '密碼修改成功，請用新密碼重新登入', '비밀번호가 변경되었습니다. 다시 로그인하세요', 'Passwort geändert, bitte neu anmelden', 'Contraseña cambiada, vuelva a iniciar sesión', 'Mot de passe modifié, reconnectez-vous', 'Пароль изменён, войдите заново', 'Đã đổi mật khẩu, vui lòng đăng nhập lại', 'เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่'],
  ['修改密码失败', 'Failed to change password', 'パスワード変更に失敗しました', '修改密碼失敗', '비밀번호 변경 실패', 'Passwort ändern fehlgeschlagen', 'Error al cambiar la contraseña', 'Échec du changement de mot de passe', 'Не удалось изменить пароль', 'Đổi mật khẩu thất bại', 'เปลี่ยนรหัสผ่านไม่สำเร็จ'],
  // ---- 供应商权限配置页 ----
  ['正式账套', 'Production ledger', '本番データ', '正式帳套', '운영 데이터베이스', 'Produktivdatenbank', 'Base de producción', 'Base de production', 'Рабочая база', 'Dữ liệu chính thức', 'ฐานข้อมูลใช้งานจริง'],
  ['测试账套', 'Test ledger', 'テストデータ', '測試帳套', '테스트 데이터베이스', 'Testdatenbank', 'Base de prueba', 'Base de test', 'Тестовая база', 'Dữ liệu thử nghiệm', 'ฐานข้อมูลทดสอบ'],
  ['刷新', 'Refresh', '更新', '重新整理', '새로고침', 'Aktualisieren', 'Actualizar', 'Actualiser', 'Обновить', 'Làm mới', 'รีเฟรช'],
  ['新增供应商账号', 'New Supplier Account', '仕入先アカウント追加', '新增供應商帳號', '공급업체 계정 추가', 'Lieferantenkonto anlegen', 'Nueva cuenta de proveedor', 'Nouveau compte fournisseur', 'Новый аккаунт поставщика', 'Thêm tài khoản nhà cung cấp', 'เพิ่มบัญชีผู้จัดจำหน่าย'],
  ['供应商账号登录后只能看到「供应商采购打印」一页,只能查看和打印所绑定供应商编码名下的采购订单,没有其它任何权限。',
    'After signing in, a supplier account only sees the Supplier Purchase Print page and can only view and print purchase orders under its bound supplier code. It has no other permissions.',
    '仕入先アカウントはログイン後「仕入先購買印刷」ページのみ表示され、紐付けた仕入先コードの購買発注の閲覧・印刷のみ可能で、その他の権限はありません。',
    '供應商帳號登入後只會看到「供應商採購列印」一頁,只能檢視與列印所綁定供應商編碼名下的採購訂單,沒有任何其它權限。',
    '공급업체 계정은 로그인 후 공급업체 구매 인쇄 페이지만 볼 수 있으며, 연결된 공급업체 코드의 구매 발주만 조회·인쇄할 수 있습니다.',
    'Ein Lieferantenkonto sieht nach der Anmeldung nur die Seite Lieferanten-Einkaufsdruck und kann ausschließlich Bestellungen des verknüpften Lieferantencodes ansehen und drucken.',
    'Tras iniciar sesión, una cuenta de proveedor solo ve la página Impresión de compras de proveedores y solo puede ver e imprimir pedidos de su código de proveedor.',
    'Après connexion, un compte fournisseur ne voit que la page Impression achats fournisseurs et ne peut consulter et imprimer que les commandes de son code fournisseur.',
    'После входа аккаунт поставщика видит только страницу печати закупок и может просматривать и печатать только заказы своего кода поставщика.',
    'Sau khi đăng nhập, tài khoản nhà cung cấp chỉ thấy trang In phiếu mua hàng và chỉ xem/in được đơn mua hàng thuộc mã nhà cung cấp đã gán.',
    'หลังเข้าสู่ระบบ บัญชีผู้จัดจำหน่ายเห็นเฉพาะหน้าพิมพ์ใบสั่งซื้อ และดู/พิมพ์ได้เฉพาะใบสั่งซื้อของรหัสผู้จัดจำหน่ายที่ผูกไว้'],
  ['供应商账号', 'Supplier accounts', '仕入先アカウント', '供應商帳號', '공급업체 계정', 'Lieferantenkonten', 'Cuentas de proveedor', 'Comptes fournisseurs', 'Аккаунты поставщиков', 'Tài khoản nhà cung cấp', 'บัญชีผู้จัดจำหน่าย'],
  ['已启用', 'Enabled', '有効', '已啟用', '사용 중', 'Aktiv', 'Habilitado', 'Activé', 'Включено', 'Đang hoạt động', 'เปิดใช้งาน'],
  ['启用', 'Enable', '有効', '啟用', '사용', 'Aktivieren', 'Habilitar', 'Activer', 'Включить', 'Kích hoạt', 'เปิดใช้งาน'],
  ['涉及供应商', 'Suppliers', '対象仕入先', '涉及供應商', '대상 공급업체', 'Lieferanten', 'Proveedores', 'Fournisseurs', 'Поставщики', 'Nhà cung cấp', 'ผู้จัดจำหน่าย'],
  ['近30天打印次数', 'Prints (30 days)', '印刷回数(30日)', '近30天列印次數', '인쇄 횟수(30일)', 'Drucke (30 Tage)', 'Impresiones (30 días)', 'Impressions (30 j)', 'Печать (30 дн.)', 'Số lần in (30 ngày)', 'จำนวนการพิมพ์ (30 วัน)'],
  ['搜索账号 / 供应商编码 / 供应商名称', 'Search account / supplier code / supplier name', 'アカウント・仕入先コード・仕入先名で検索', '搜尋帳號 / 供應商編碼 / 供應商名稱', '계정/공급업체 코드/공급업체명 검색', 'Konto / Lieferantencode / Lieferantenname suchen', 'Buscar cuenta / código / nombre de proveedor', 'Rechercher compte / code / nom du fournisseur', 'Поиск: аккаунт / код / наименование', 'Tìm tài khoản / mã / tên nhà cung cấp', 'ค้นหาบัญชี / รหัส / ชื่อผู้จัดจำหน่าย'],
  ['还没有供应商账号,点右上角「新增供应商账号」', 'No supplier accounts yet — click “New Supplier Account”', '仕入先アカウントはまだありません。右上の「仕入先アカウント追加」から作成してください', '還沒有供應商帳號,點右上角「新增供應商帳號」', '공급업체 계정이 없습니다. 오른쪽 위 추가를 누르세요', 'Noch keine Lieferantenkonten', 'Aún no hay cuentas de proveedor', 'Aucun compte fournisseur', 'Аккаунтов поставщиков пока нет', 'Chưa có tài khoản nhà cung cấp', 'ยังไม่มีบัญชีผู้จัดจำหน่าย'],
  ['供应商名称', 'Supplier Name', '仕入先名', '供應商名稱', '공급업체명', 'Lieferantenname', 'Nombre del proveedor', 'Nom du fournisseur', 'Наименование поставщика', 'Tên nhà cung cấp', 'ชื่อผู้จัดจำหน่าย'],
  ['姓名', 'Name', '氏名', '姓名', '이름', 'Name', 'Nombre', 'Nom', 'Имя', 'Họ tên', 'ชื่อ'],
  ['状态', 'Status', '状態', '狀態', '상태', 'Status', 'Estado', 'Statut', 'Статус', 'Trạng thái', 'สถานะ'],
  ['停用', 'Disabled', '無効', '停用', '중지', 'Deaktiviert', 'Deshabilitado', 'Désactivé', 'Отключено', 'Ngừng', 'ปิดใช้งาน'],
  ['创建时间', 'Created', '作成日時', '建立時間', '생성 일시', 'Erstellt', 'Creado', 'Créé le', 'Создан', 'Thời điểm tạo', 'สร้างเมื่อ'],
  ['创建人', 'Created by', '作成者', '建立人', '생성자', 'Erstellt von', 'Creado por', 'Créé par', 'Создал', 'Người tạo', 'สร้างโดย'],
  ['编辑', 'Edit', '編集', '編輯', '편집', 'Bearbeiten', 'Editar', 'Modifier', 'Изменить', 'Sửa', 'แก้ไข'],
  ['重置密码', 'Reset password', 'パスワード再設定', '重設密碼', '비밀번호 재설정', 'Passwort zurücksetzen', 'Restablecer contraseña', 'Réinitialiser le mot de passe', 'Сбросить пароль', 'Đặt lại mật khẩu', 'รีเซ็ตรหัสผ่าน'],
  ['删除', 'Delete', '削除', '刪除', '삭제', 'Löschen', 'Eliminar', 'Supprimer', 'Удалить', 'Xóa', 'ลบ'],
  ['编辑供应商账号', 'Edit Supplier Account', '仕入先アカウント編集', '編輯供應商帳號', '공급업체 계정 편집', 'Lieferantenkonto bearbeiten', 'Editar cuenta de proveedor', 'Modifier le compte fournisseur', 'Изменить аккаунт поставщика', 'Sửa tài khoản nhà cung cấp', 'แก้ไขบัญชีผู้จัดจำหน่าย'],
  ['账号', 'Account', 'アカウント', '帳號', '계정', 'Konto', 'Cuenta', 'Compte', 'Аккаунт', 'Tài khoản', 'บัญชี'],
  ['3~40 位字母/数字/下划线,如 kbl01', '3–40 letters/digits/underscore, e.g. kbl01', '英数字とアンダースコア 3~40 文字(例:kbl01)', '3~40 位字母/數字/底線,如 kbl01', '영문/숫자/밑줄 3~40자 (예: kbl01)', '3–40 Zeichen (Buchstaben/Ziffern/_), z. B. kbl01', '3–40 letras/dígitos/guion bajo, p. ej. kbl01', '3 à 40 lettres/chiffres/_, ex. kbl01', '3–40 букв/цифр/_, напр. kbl01', '3–40 ký tự chữ/số/gạch dưới, vd. kbl01', '3–40 ตัวอักษร/ตัวเลข/_ เช่น kbl01'],
  ['账号创建后不可改名;如需换名,请新建账号并停用旧账号。', 'The account name cannot be changed; create a new account and disable the old one.', 'アカウント名は変更できません。新しいアカウントを作成し、旧アカウントを無効にしてください。', '帳號建立後不可改名;如需換名,請新建帳號並停用舊帳號。', '계정명은 변경할 수 없습니다. 새 계정을 만들고 기존 계정을 중지하세요.', 'Der Kontoname ist unveränderlich; neues Konto anlegen und altes deaktivieren.', 'El nombre de la cuenta no se puede cambiar.', 'Le nom du compte ne peut pas être modifié.', 'Имя аккаунта изменить нельзя.', 'Không thể đổi tên tài khoản sau khi tạo.', 'ไม่สามารถเปลี่ยนชื่อบัญชีได้หลังสร้าง'],
  ['选择供应商(可输入编码或名称搜索)', 'Select a supplier (search by code or name)', '仕入先を選択(コード・名称で検索可)', '選擇供應商(可輸入編碼或名稱搜尋)', '공급업체 선택 (코드/이름으로 검색)', 'Lieferant wählen (Code oder Name)', 'Seleccione un proveedor', 'Sélectionner un fournisseur', 'Выберите поставщика', 'Chọn nhà cung cấp', 'เลือกผู้จัดจำหน่าย'],
  ['默认取供应商名称', 'Defaults to the supplier name', '既定値は仕入先名', '預設取供應商名稱', '기본값: 공급업체명', 'Standard: Lieferantenname', 'Por defecto: nombre del proveedor', 'Par défaut : nom du fournisseur', 'По умолчанию — наименование поставщика', 'Mặc định lấy tên nhà cung cấp', 'ค่าเริ่มต้น: ชื่อผู้จัดจำหน่าย'],
  ['登录密码', 'Password', 'ログインパスワード', '登入密碼', '로그인 비밀번호', 'Passwort', 'Contraseña', 'Mot de passe', 'Пароль', 'Mật khẩu', 'รหัสผ่าน'],
  ['留空则不修改', 'Leave blank to keep current', '空欄なら変更しません', '留空則不修改', '비워두면 변경 안 함', 'Leer lassen = unverändert', 'Dejar vacío para no cambiar', 'Laisser vide pour ne pas changer', 'Пусто — не менять', 'Để trống nếu không đổi', 'เว้นว่างเพื่อไม่เปลี่ยน'],
  ['至少 6 位', 'At least 6 characters', '6文字以上', '至少 6 位', '6자 이상', 'Mindestens 6 Zeichen', 'Al menos 6 caracteres', 'Au moins 6 caractères', 'Не менее 6 символов', 'Tối thiểu 6 ký tự', 'อย่างน้อย 6 ตัวอักษร'],
  ['停用后该账号立即无法登录,已登录的会话也会被挡下。', 'Once disabled, the account cannot sign in and active sessions are blocked.', '無効にするとログインできなくなり、ログイン中のセッションも拒否されます。', '停用後該帳號立即無法登入,已登入的工作階段也會被擋下。', '중지하면 즉시 로그인할 수 없고 기존 세션도 차단됩니다.', 'Nach Deaktivierung keine Anmeldung mehr möglich.', 'Al deshabilitar no podrá iniciar sesión.', 'Une fois désactivé, la connexion est impossible.', 'После отключения вход невозможен.', 'Sau khi ngừng sẽ không thể đăng nhập.', 'เมื่อปิดใช้งานจะเข้าสู่ระบบไม่ได้'],
  ['供应商采购打印(只读 + 打印本公司采购订单)', 'Supplier Purchase Print (read-only + print own purchase orders)', '仕入先購買印刷(閲覧のみ+自社発注の印刷)', '供應商採購列印(唯讀 + 列印本公司採購訂單)', '공급업체 구매 인쇄 (읽기 전용 + 자사 발주 인쇄)', 'Lieferanten-Einkaufsdruck (nur lesen + drucken)', 'Impresión de compras (solo lectura + imprimir)', 'Impression achats (lecture seule + impression)', 'Печать закупок (только чтение + печать)', 'In phiếu mua hàng (chỉ đọc + in)', 'พิมพ์ใบสั่งซื้อ (อ่านเท่านั้น + พิมพ์)'],
  ['加载供应商账号失败', 'Failed to load supplier accounts', '仕入先アカウントの取得に失敗しました', '載入供應商帳號失敗', '공급업체 계정 조회 실패', 'Lieferantenkonten konnten nicht geladen werden', 'Error al cargar las cuentas', 'Échec du chargement des comptes', 'Не удалось загрузить аккаунты', 'Tải tài khoản thất bại', 'โหลดบัญชีไม่สำเร็จ'],
  ['请填写账号与供应商', 'Please fill in account and supplier', 'アカウントと仕入先を入力してください', '請填寫帳號與供應商', '계정과 공급업체를 입력하세요', 'Bitte Konto und Lieferant angeben', 'Complete la cuenta y el proveedor', 'Renseignez le compte et le fournisseur', 'Укажите аккаунт и поставщика', 'Nhập tài khoản và nhà cung cấp', 'กรอกบัญชีและผู้จัดจำหน่าย'],
  ['请设置登录密码', 'Please set a password', 'ログインパスワードを設定してください', '請設定登入密碼', '로그인 비밀번호를 설정하세요', 'Bitte ein Passwort setzen', 'Establezca una contraseña', 'Définissez un mot de passe', 'Задайте пароль', 'Hãy đặt mật khẩu', 'กรุณาตั้งรหัสผ่าน'],
  ['已保存', 'Saved', '保存しました', '已儲存', '저장되었습니다', 'Gespeichert', 'Guardado', 'Enregistré', 'Сохранено', 'Đã lưu', 'บันทึกแล้ว'],
  ['保存失败', 'Save failed', '保存に失敗しました', '儲存失敗', '저장 실패', 'Speichern fehlgeschlagen', 'Error al guardar', 'Échec de l’enregistrement', 'Ошибка сохранения', 'Lưu thất bại', 'บันทึกไม่สำเร็จ'],
  ['停用后该供应商账号立即无法登录,已登录的会话也会被挡下。确定停用', 'Once disabled, this supplier account cannot sign in and active sessions are blocked. Disable', '無効にするとログイン不可となり、ログイン中のセッションも拒否されます。無効にしますか', '停用後該供應商帳號立即無法登入,已登入的工作階段也會被擋下。確定停用', '중지하면 즉시 로그인할 수 없고 세션도 차단됩니다. 중지하시겠습니까', 'Nach Deaktivierung keine Anmeldung möglich. Deaktivieren', 'Al deshabilitar no podrá iniciar sesión. ¿Deshabilitar', 'Une fois désactivé, connexion impossible. Désactiver', 'После отключения вход невозможен. Отключить', 'Sau khi ngừng sẽ không thể đăng nhập. Ngừng', 'เมื่อปิดใช้งานจะเข้าสู่ระบบไม่ได้ ปิดใช้งาน'],
  ['停用供应商账号', 'Disable Supplier Account', '仕入先アカウント無効化', '停用供應商帳號', '공급업체 계정 중지', 'Lieferantenkonto deaktivieren', 'Deshabilitar cuenta de proveedor', 'Désactiver le compte fournisseur', 'Отключить аккаунт поставщика', 'Ngừng tài khoản nhà cung cấp', 'ปิดใช้งานบัญชีผู้จัดจำหน่าย'],
  ['已停用', 'Disabled', '無効にしました', '已停用', '중지되었습니다', 'Deaktiviert', 'Deshabilitado', 'Désactivé', 'Отключено', 'Đã ngừng', 'ปิดใช้งานแล้ว'],
  ['操作失败', 'Operation failed', '操作に失敗しました', '操作失敗', '작업 실패', 'Vorgang fehlgeschlagen', 'Operación fallida', 'Échec de l’opération', 'Ошибка операции', 'Thao tác thất bại', 'ดำเนินการไม่สำเร็จ'],
  ['为账号', 'Set a new password for account', 'アカウントの新しいパスワード', '為帳號', '계정의 새 비밀번호', 'Neues Passwort für Konto', 'Nueva contraseña para la cuenta', 'Nouveau mot de passe du compte', 'Новый пароль для аккаунта', 'Mật khẩu mới cho tài khoản', 'รหัสผ่านใหม่สำหรับบัญชี'],
  ['设置新密码(至少 6 位)', 'set a new password (at least 6 characters)', '新しいパスワード(6文字以上)を設定', '設定新密碼(至少 6 位)', '새 비밀번호(6자 이상) 설정', 'neues Passwort (min. 6 Zeichen) setzen', 'establecer una nueva contraseña (mín. 6)', 'définir un nouveau mot de passe (min. 6)', 'задать новый пароль (не короче 6)', 'đặt mật khẩu mới (tối thiểu 6 ký tự)', 'ตั้งรหัสผ่านใหม่ (อย่างน้อย 6)'],
  ['密码已重置', 'Password reset', 'パスワードを再設定しました', '密碼已重設', '비밀번호가 재설정되었습니다', 'Passwort zurückgesetzt', 'Contraseña restablecida', 'Mot de passe réinitialisé', 'Пароль сброшен', 'Đã đặt lại mật khẩu', 'รีเซ็ตรหัสผ่านแล้ว'],
  ['重置密码失败', 'Failed to reset password', 'パスワード再設定に失敗しました', '重設密碼失敗', '비밀번호 재설정 실패', 'Zurücksetzen fehlgeschlagen', 'Error al restablecer', 'Échec de la réinitialisation', 'Не удалось сбросить пароль', 'Đặt lại mật khẩu thất bại', 'รีเซ็ตรหัสผ่านไม่สำเร็จ'],
  ['删除供应商账号', 'Delete Supplier Account', '仕入先アカウント削除', '刪除供應商帳號', '공급업체 계정 삭제', 'Lieferantenkonto löschen', 'Eliminar cuenta de proveedor', 'Supprimer le compte fournisseur', 'Удалить аккаунт поставщика', 'Xóa tài khoản nhà cung cấp', 'ลบบัญชีผู้จัดจำหน่าย'],
  ['删除后该账号不能再登录(历史打印记录保留)。', 'The account can no longer sign in (print history is kept).', '削除後はログインできません(印刷履歴は保持されます)。', '刪除後該帳號不能再登入(歷史列印記錄保留)。', '삭제 후 로그인할 수 없습니다(인쇄 이력은 보존).', 'Danach keine Anmeldung mehr (Druckhistorie bleibt).', 'La cuenta ya no podrá acceder (se conserva el historial).', 'Le compte ne pourra plus se connecter (historique conservé).', 'Вход станет невозможен (история печати сохраняется).', 'Sau khi xóa sẽ không đăng nhập được (giữ lịch sử in).', 'ลบแล้วจะเข้าสู่ระบบไม่ได้ (เก็บประวัติการพิมพ์ไว้)'],
  ['已删除', 'Deleted', '削除しました', '已刪除', '삭제되었습니다', 'Gelöscht', 'Eliminado', 'Supprimé', 'Удалено', 'Đã xóa', 'ลบแล้ว'],
  ['删除失败', 'Delete failed', '削除に失敗しました', '刪除失敗', '삭제 실패', 'Löschen fehlgeschlagen', 'Error al eliminar', 'Échec de la suppression', 'Ошибка удаления', 'Xóa thất bại', 'ลบไม่สำเร็จ'],
]

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")

let changed = 0
for (const loc of LOCALES) {
  const file = path.join(ROOT, 'frontend', 'src', 'i18n', 'locales', `${loc}.js`)
  if (!fs.existsSync(file)) {
    console.warn(`[skip] 缺语言包 ${loc}`)
    continue
  }
  let text = fs.readFileSync(file, 'utf8')
  const missing = []
  const col = LOCALES.indexOf(loc) + 1
  for (const row of TERMS) {
    const key = row[0]
    const val = row[col]
    if (!val) continue
    // 已有键(不论单引号/双引号)一律跳过:人工校对优先
    const re = new RegExp(`^\\s*(['"])${esc(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:`, 'm')
    if (re.test(text)) continue
    missing.push([key, val])
  }
  if (!missing.length) {
    console.log(`[ok] ${loc}:无新增词条`)
    continue
  }
  const block = missing.map(([k, v]) => `    '${esc(k)}': '${esc(v)}',`).join('\n')
  // 插到 biz 字典末尾:找最后一个 `  },\n\n}` 结构(各语言包都以 biz 收尾)
  const idx = text.lastIndexOf('  },\n')
  if (idx < 0) {
    console.warn(`[warn] ${loc}:未找到 biz 字典结尾,跳过`)
    continue
  }
  text = text.slice(0, idx) + block + '\n' + text.slice(idx)
  fs.writeFileSync(file, text, 'utf8')
  console.log(`[+${missing.length}] ${loc}`)
  changed += missing.length
}
console.log(`完成:共追加 ${changed} 条词条`)
