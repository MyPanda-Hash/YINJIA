/* ============================================================================
 * i18n-supplier-picker-20261025.sql —— 供应商「勾选弹窗」文案译名
 * ----------------------------------------------------------------------------
 * 用户口径(2026-10-25):「供应商权限配置的不要下来框,要是可以勾选的弹窗。
 *   单据的关联供应商基础资料是一样的。」「每次勾选,账号密码都要对应变化」
 *   → 实际只让账号(=供应商编码)跟着变,密码/姓名不动。
 *
 * 本次新增文案:选择供应商 / 选择 / 确定 / 勾选提示 / 搜索占位 / 档案列名
 * (供应商编码·供应商名称·联系人·电话·地址) / 空态 / 失败提示 / 加载中 / 共…条
 * 已存在即跳过(不覆盖人工校对);幂等可重跑。两账套均需执行。
 * 前端静态语言包同一批词条由 tools/archive/_gen-supplier-portal-i18n.mjs 生成。
 * ========================================================================== */

SET NOCOUNT ON;
GO

DECLARE @t TABLE (ref_key nvarchar(400) NOT NULL, locale nvarchar(10) NOT NULL, text nvarchar(900) NOT NULL);

INSERT INTO @t (ref_key, locale, text) VALUES
 (N'选择供应商','en',N'Select Supplier'),(N'选择供应商','ja',N'仕入先を選択'),(N'选择供应商','ko',N'공급업체 선택'),
 (N'选择供应商','de',N'Lieferant wählen'),(N'选择供应商','es',N'Seleccionar proveedor'),(N'选择供应商','fr',N'Choisir un fournisseur'),
 (N'选择供应商','ru',N'Выбрать поставщика'),(N'选择供应商','vi',N'Chọn nhà cung cấp'),(N'选择供应商','th',N'เลือกผู้จัดจำหน่าย'),

 (N'选择','en',N'Select'),(N'选择','ja',N'選択'),(N'选择','ko',N'선택'),
 (N'选择','de',N'Wählen'),(N'选择','es',N'Seleccionar'),(N'选择','fr',N'Choisir'),
 (N'选择','ru',N'Выбрать'),(N'选择','vi',N'Chọn'),(N'选择','th',N'เลือก'),

 (N'点右侧「选择」勾选供应商','en',N'Click "Select" to pick a supplier'),(N'点右侧「选择」勾选供应商','ja',N'右の「選択」から仕入先を選びます'),
 (N'点右侧「选择」勾选供应商','ko',N'오른쪽 선택에서 공급업체를 고르세요'),(N'点右侧「选择」勾选供应商','de',N'Rechts auf Wählen klicken'),
 (N'点右侧「选择」勾选供应商','es',N'Pulse Seleccionar a la derecha'),(N'点右侧「选择」勾选供应商','fr',N'Cliquez sur Choisir à droite'),
 (N'点右侧「选择」勾选供应商','ru',N'Нажмите Выбрать справа'),(N'点右侧「选择」勾选供应商','vi',N'Bấm Chọn ở bên phải'),
 (N'点右侧「选择」勾选供应商','th',N'กดเลือกทางด้านขวา'),

 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','en',
  N'Picked from the supplier master; the account then defaults to that supplier code (editable).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','ja',
  N'仕入先マスタから選択します。選択後アカウントは仕入先コードが自動入力され(変更可)。'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','ko',
  N'공급업체 마스터에서 선택합니다. 선택 후 계정에 해당 코드가 자동 입력됩니다(수정 가능).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','de',
  N'Aus dem Lieferantenstamm wählen; das Konto wird dann mit dem Code vorbelegt (änderbar).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','es',
  N'Se elige del maestro de proveedores; la cuenta toma ese código (editable).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','fr',
  N'Choisi dans la fiche fournisseur ; le compte reprend ensuite ce code (modifiable).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','ru',
  N'Выбор из справочника поставщиков; в аккаунт подставляется его код (можно изменить).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','vi',
  N'Chọn từ danh mục nhà cung cấp; tài khoản sẽ tự điền mã đó (có thể sửa).'),
 (N'从供应商档案勾选;勾选后账号自动填该供应商编码,可手动修改。','th',
  N'เลือกจากทะเบียนผู้จัดจำหน่าย แล้วบัญชีจะเติมรหัสนั้นให้ (แก้ไขได้)'),

 (N'输入关键字过滤(编码/名称/联系人/电话)','en',N'Filter by code / name / contact / phone'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','ja',N'コード・名称・担当・電話で絞り込み'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','ko',N'코드/이름/담당자/전화로 필터'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','de',N'Nach Code/Name/Ansprechpartner/Telefon filtern'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','es',N'Filtrar por código/nombre/contacto/teléfono'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','fr',N'Filtrer par code / nom / contact / téléphone'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','ru',N'Фильтр по коду/названию/контакту/телефону'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','vi',N'Lọc theo mã/tên/liên hệ/điện thoại'),
 (N'输入关键字过滤(编码/名称/联系人/电话)','th',N'กรองตามรหัส/ชื่อ/ผู้ติดต่อ/โทรศัพท์'),

 (N'供应商名称','en',N'Supplier Name'),(N'供应商名称','ja',N'仕入先名'),(N'供应商名称','ko',N'공급업체명'),
 (N'供应商名称','de',N'Lieferantenname'),(N'供应商名称','es',N'Nombre de proveedor'),(N'供应商名称','fr',N'Nom du fournisseur'),
 (N'供应商名称','ru',N'Наименование поставщика'),(N'供应商名称','vi',N'Tên nhà cung cấp'),(N'供应商名称','th',N'ชื่อผู้จัดจำหน่าย'),

 (N'联系人','en',N'Contact'),(N'联系人','ja',N'担当者'),(N'联系人','ko',N'담당자'),
 (N'联系人','de',N'Ansprechpartner'),(N'联系人','es',N'Contacto'),(N'联系人','fr',N'Contact'),
 (N'联系人','ru',N'Контактное лицо'),(N'联系人','vi',N'Người liên hệ'),(N'联系人','th',N'ผู้ติดต่อ'),

 (N'电话','en',N'Phone'),(N'电话','ja',N'電話'),(N'电话','ko',N'전화'),
 (N'电话','de',N'Telefon'),(N'电话','es',N'Teléfono'),(N'电话','fr',N'Téléphone'),
 (N'电话','ru',N'Телефон'),(N'电话','vi',N'Điện thoại'),(N'电话','th',N'โทรศัพท์'),

 (N'地址','en',N'Address'),(N'地址','ja',N'住所'),(N'地址','ko',N'주소'),
 (N'地址','de',N'Adresse'),(N'地址','es',N'Dirección'),(N'地址','fr',N'Adresse'),
 (N'地址','ru',N'Адрес'),(N'地址','vi',N'Địa chỉ'),(N'地址','th',N'ที่อยู่'),

 (N'没有符合条件的供应商','en',N'No matching suppliers'),(N'没有符合条件的供应商','ja',N'該当する仕入先がありません'),
 (N'没有符合条件的供应商','ko',N'조건에 맞는 공급업체가 없습니다'),(N'没有符合条件的供应商','de',N'Keine passenden Lieferanten'),
 (N'没有符合条件的供应商','es',N'No hay proveedores que coincidan'),(N'没有符合条件的供应商','fr',N'Aucun fournisseur correspondant'),
 (N'没有符合条件的供应商','ru',N'Нет подходящих поставщиков'),(N'没有符合条件的供应商','vi',N'Không có nhà cung cấp phù hợp'),
 (N'没有符合条件的供应商','th',N'ไม่พบผู้จัดจำหน่ายที่ตรงเงื่อนไข'),

 (N'请选择一个供应商','en',N'Please select a supplier'),(N'请选择一个供应商','ja',N'仕入先を選択してください'),
 (N'请选择一个供应商','ko',N'공급업체를 선택하세요'),(N'请选择一个供应商','de',N'Bitte einen Lieferanten wählen'),
 (N'请选择一个供应商','es',N'Seleccione un proveedor'),(N'请选择一个供应商','fr',N'Veuillez choisir un fournisseur'),
 (N'请选择一个供应商','ru',N'Выберите поставщика'),(N'请选择一个供应商','vi',N'Vui lòng chọn nhà cung cấp'),
 (N'请选择一个供应商','th',N'กรุณาเลือกผู้จัดจำหน่าย'),

 (N'加载供应商档案失败','en',N'Failed to load supplier master'),(N'加载供应商档案失败','ja',N'仕入先マスタの読み込みに失敗しました'),
 (N'加载供应商档案失败','ko',N'공급업체 마스터를 불러오지 못했습니다'),(N'加载供应商档案失败','de',N'Lieferantenstamm konnte nicht geladen werden'),
 (N'加载供应商档案失败','es',N'No se pudo cargar el maestro de proveedores'),(N'加载供应商档案失败','fr',N'Échec du chargement de la fiche fournisseur'),
 (N'加载供应商档案失败','ru',N'Не удалось загрузить справочник поставщиков'),(N'加载供应商档案失败','vi',N'Không tải được danh mục nhà cung cấp'),
 (N'加载供应商档案失败','th',N'โหลดทะเบียนผู้จัดจำหน่ายไม่สำเร็จ'),

 (N'加载中…','en',N'Loading…'),(N'加载中…','ja',N'読み込み中…'),(N'加载中…','ko',N'불러오는 중…'),
 (N'加载中…','de',N'Wird geladen…'),(N'加载中…','es',N'Cargando…'),(N'加载中…','fr',N'Chargement…'),
 (N'加载中…','ru',N'Загрузка…'),(N'加载中…','vi',N'Đang tải…'),(N'加载中…','th',N'กำลังโหลด…');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT N'field', t.ref_key, t.locale, t.text, N'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = N'field' AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'供应商勾选弹窗文案译名已写入(已存在的不覆盖)';
GO

/* ---------- 自检:每个键 9 语言 ---------- */
DECLARE @bad nvarchar(1000) = N'';
SELECT @bad = @bad + ref_key + N'(' + CAST(c AS varchar) + N')'
  FROM (SELECT ref_key, COUNT(*) AS c FROM yj_translation
         WHERE scope = N'field' AND source = N'manual'
           AND ref_key IN (N'选择供应商', N'点右侧「选择」勾选供应商', N'供应商名称',
                           N'联系人', N'电话', N'地址', N'没有符合条件的供应商',
                           N'请选择一个供应商', N'加载供应商档案失败')
         GROUP BY ref_key) t
 WHERE c < 9;
IF @bad <> N'' RAISERROR(N'自检失败:以下词条语言数不足 9: %s', 16, 1, @bad);

SELECT ref_key AS 文案, COUNT(*) AS 语言数 FROM yj_translation
 WHERE scope = N'field' AND source = N'manual'
   AND ref_key IN (N'选择供应商', N'供应商名称', N'联系人', N'电话', N'地址')
 GROUP BY ref_key ORDER BY ref_key;
GO
PRINT N'✅ 供应商勾选弹窗文案译名就绪';
GO
