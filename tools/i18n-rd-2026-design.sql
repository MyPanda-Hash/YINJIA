-- i18n-rd-2026-design.sql — 研发管理最新设计 字段能力层配套多语言
--
-- 【为什么必须一起交付】AGENTS.md 硬性规定:新增面板/字段必须同时交付多语言,否则视为功能未完成。
--   本脚本覆盖 Phase 1 的**三类**:① 新面板名 ② 新字段 label ③ **改过 label 的字段**
--   (label 是译名键 scope='field' —— 改了 label 不同步加译名,英文界面就显中文)。
--
-- 幂等:NOT EXISTS 按 (scope, ref_key, locale) 去重,可重复执行。
-- 语言:与 yj_locale 启用清单一致(en/ja/ko/es/fr/de/ru/vi/th/zh-TW 共 10 种)。
-- 用法:sqlcmd -f 65001 / SqlRunner
USE HSDZ_MES;
SET NOCOUNT ON;
GO

-- ═══════════════════════════════════════════════════════════════════
-- 1. 新面板名(scope='panel')
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT v.scope, v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  ('panel', N'产品文件列表', 'en', N'Product Document List'),
  ('panel', N'产品文件列表', 'ja', N'製品文書一覧'),
  ('panel', N'产品文件列表', 'ko', N'제품 문서 목록'),
  ('panel', N'产品文件列表', 'es', N'Lista de documentos de producto'),
  ('panel', N'产品文件列表', 'fr', N'Liste des documents produit'),
  ('panel', N'产品文件列表', 'de', N'Produktdokumentliste'),
  ('panel', N'产品文件列表', 'ru', N'Список документов изделия'),
  ('panel', N'产品文件列表', 'vi', N'Danh sách tài liệu sản phẩm'),
  ('panel', N'产品文件列表', 'th', N'รายการเอกสารผลิตภัณฑ์'),
  ('panel', N'产品文件列表', 'zh-TW', N'產品文件列表'),

  ('panel', N'样品编号表', 'en', N'Sample Number Registry'),
  ('panel', N'样品编号表', 'ja', N'サンプル番号表'),
  ('panel', N'样品编号表', 'ko', N'샘플 번호표'),
  ('panel', N'样品编号表', 'es', N'Registro de números de muestra'),
  ('panel', N'样品编号表', 'fr', N'Registre des numéros d''échantillon'),
  ('panel', N'样品编号表', 'de', N'Muster-Nummernregister'),
  ('panel', N'样品编号表', 'ru', N'Реестр номеров образцов'),
  ('panel', N'样品编号表', 'vi', N'Sổ đăng ký số mẫu'),
  ('panel', N'样品编号表', 'th', N'ทะเบียนหมายเลขตัวอย่าง'),
  ('panel', N'样品编号表', 'zh-TW', N'樣品編號表')
) AS v(scope, ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = v.scope AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 2. 字段译名(scope='field')
--    分三组:A 全新字段 / B 改过 label 的字段 / C 新面板的通用字段
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', v.ref_key, v.locale, v.text, 'manual'
FROM (VALUES
  -- ═══ A. 全新字段 ═══
  -- 客户项目名称(4 面板共用:RD_PROD_INFO 真源 + RD_ASM_PROC/RD_INSP_PLAN/RD_SPEC_DOC 参照带回)
  (N'客户项目名称', 'en', N'Customer Project Name'), (N'客户项目名称', 'ja', N'顧客プロジェクト名'),
  (N'客户项目名称', 'ko', N'고객 프로젝트명'),       (N'客户项目名称', 'es', N'Nombre del proyecto del cliente'),
  (N'客户项目名称', 'fr', N'Nom du projet client'),  (N'客户项目名称', 'de', N'Kundenprojektname'),
  (N'客户项目名称', 'ru', N'Название проекта клиента'), (N'客户项目名称', 'vi', N'Tên dự án khách hàng'),
  (N'客户项目名称', 'th', N'ชื่อโครงการของลูกค้า'),   (N'客户项目名称', 'zh-TW', N'客戶專案名稱'),

  (N'产品管控等级', 'en', N'Product Control Grade'), (N'产品管控等级', 'ja', N'製品管理等級'),
  (N'产品管控等级', 'ko', N'제품 관리 등급'),        (N'产品管控等级', 'es', N'Grado de control del producto'),
  (N'产品管控等级', 'fr', N'Niveau de contrôle produit'), (N'产品管控等级', 'de', N'Produktkontrollstufe'),
  (N'产品管控等级', 'ru', N'Уровень контроля изделия'), (N'产品管控等级', 'vi', N'Cấp quản lý sản phẩm'),
  (N'产品管控等级', 'th', N'ระดับควบคุมผลิตภัณฑ์'),  (N'产品管控等级', 'zh-TW', N'產品管控等級'),

  (N'产品功能类别', 'en', N'Product Function Category'), (N'产品功能类别', 'ja', N'製品機能分類'),
  (N'产品功能类别', 'ko', N'제품 기능 분류'),        (N'产品功能类别', 'es', N'Categoría funcional del producto'),
  (N'产品功能类别', 'fr', N'Catégorie fonctionnelle'), (N'产品功能类别', 'de', N'Produktfunktionskategorie'),
  (N'产品功能类别', 'ru', N'Функциональная категория'), (N'产品功能类别', 'vi', N'Loại chức năng sản phẩm'),
  (N'产品功能类别', 'th', N'หมวดหมู่ฟังก์ชันผลิตภัณฑ์'), (N'产品功能类别', 'zh-TW', N'產品功能類別'),

  (N'编辑人', 'en', N'Editor'), (N'编辑人', 'ja', N'編集者'), (N'编辑人', 'ko', N'편집자'),
  (N'编辑人', 'es', N'Editor'), (N'编辑人', 'fr', N'Éditeur'), (N'编辑人', 'de', N'Bearbeiter'),
  (N'编辑人', 'ru', N'Редактор'), (N'编辑人', 'vi', N'Người chỉnh sửa'),
  (N'编辑人', 'th', N'ผู้แก้ไข'), (N'编辑人', 'zh-TW', N'編輯人'),

  (N'审核人（一级审核）', 'en', N'Reviewer (L1)'), (N'审核人（一级审核）', 'ja', N'承認者(一次審査)'),
  (N'审核人（一级审核）', 'ko', N'승인자(1차)'),     (N'审核人（一级审核）', 'es', N'Revisor (nivel 1)'),
  (N'审核人（一级审核）', 'fr', N'Approbateur (N1)'), (N'审核人（一级审核）', 'de', N'Prüfer (Stufe 1)'),
  (N'审核人（一级审核）', 'ru', N'Утверждающий (1 ур.)'), (N'审核人（一级审核）', 'vi', N'Người duyệt (cấp 1)'),
  (N'审核人（一级审核）', 'th', N'ผู้อนุมัติ (ระดับ 1)'), (N'审核人（一级审核）', 'zh-TW', N'審核人（一級審核）'),

  (N'审核人（二级审核）', 'en', N'Reviewer (L2)'), (N'审核人（二级审核）', 'ja', N'承認者(二次審査)'),
  (N'审核人（二级审核）', 'ko', N'승인자(2차)'),     (N'审核人（二级审核）', 'es', N'Revisor (nivel 2)'),
  (N'审核人（二级审核）', 'fr', N'Approbateur (N2)'), (N'审核人（二级审核）', 'de', N'Prüfer (Stufe 2)'),
  (N'审核人（二级审核）', 'ru', N'Утверждающий (2 ур.)'), (N'审核人（二级审核）', 'vi', N'Người duyệt (cấp 2)'),
  (N'审核人（二级审核）', 'th', N'ผู้อนุมัติ (ระดับ 2)'), (N'审核人（二级审核）', 'zh-TW', N'審核人（二級審核）'),

  (N'应用场景', 'en', N'Application Scenario'), (N'应用场景', 'ja', N'適用シーン'),
  (N'应用场景', 'ko', N'적용 시나리오'),          (N'应用场景', 'es', N'Escenario de aplicación'),
  (N'应用场景', 'fr', N'Scénario d''application'), (N'应用场景', 'de', N'Anwendungsszenario'),
  (N'应用场景', 'ru', N'Сценарий применения'),   (N'应用场景', 'vi', N'Kịch bản ứng dụng'),
  (N'应用场景', 'th', N'สถานการณ์การใช้งาน'),     (N'应用场景', 'zh-TW', N'應用場景'),

  (N'客户项目代号', 'en', N'Customer Project Code'), (N'客户项目代号', 'ja', N'顧客プロジェクトコード'),
  (N'客户项目代号', 'ko', N'고객 프로젝트 코드'),   (N'客户项目代号', 'es', N'Código de proyecto del cliente'),
  (N'客户项目代号', 'fr', N'Code projet client'), (N'客户项目代号', 'de', N'Kundenprojektcode'),
  (N'客户项目代号', 'ru', N'Код проекта клиента'), (N'客户项目代号', 'vi', N'Mã dự án khách hàng'),
  (N'客户项目代号', 'th', N'รหัสโครงการลูกค้า'),  (N'客户项目代号', 'zh-TW', N'客戶專案代號'),

  (N'样品编号', 'en', N'Sample No.'), (N'样品编号', 'ja', N'サンプル番号'), (N'样品编号', 'ko', N'샘플 번호'),
  (N'样品编号', 'es', N'N.º de muestra'), (N'样品编号', 'fr', N'N° d''échantillon'), (N'样品编号', 'de', N'Muster-Nr.'),
  (N'样品编号', 'ru', N'Номер образца'), (N'样品编号', 'vi', N'Số mẫu'),
  (N'样品编号', 'th', N'หมายเลขตัวอย่าง'), (N'样品编号', 'zh-TW', N'樣品編號'),

  (N'是否受控', 'en', N'Controlled'), (N'是否受控', 'ja', N'管理対象'), (N'是否受控', 'ko', N'관리 대상'),
  (N'是否受控', 'es', N'Controlado'), (N'是否受控', 'fr', N'Sous contrôle'), (N'是否受控', 'de', N'Gelenkt'),
  (N'是否受控', 'ru', N'Управляемый'), (N'是否受控', 'vi', N'Được kiểm soát'),
  (N'是否受控', 'th', N'ถูกควบคุม'), (N'是否受控', 'zh-TW', N'是否受控'),

  (N'受控日期', 'en', N'Control Date'), (N'受控日期', 'ja', N'管理日'), (N'受控日期', 'ko', N'관리 일자'),
  (N'受控日期', 'es', N'Fecha de control'), (N'受控日期', 'fr', N'Date de contrôle'), (N'受控日期', 'de', N'Lenkungsdatum'),
  (N'受控日期', 'ru', N'Дата контроля'), (N'受控日期', 'vi', N'Ngày kiểm soát'),
  (N'受控日期', 'th', N'วันที่ควบคุม'), (N'受控日期', 'zh-TW', N'受控日期'),

  (N'序 号', 'en', N'No.'), (N'序 号', 'ja', N'番号'), (N'序 号', 'ko', N'번호'),
  (N'序 号', 'es', N'N.º'), (N'序 号', 'fr', N'N°'), (N'序 号', 'de', N'Nr.'),
  (N'序 号', 'ru', N'№'), (N'序 号', 'vi', N'STT'), (N'序 号', 'th', N'ลำดับ'), (N'序 号', 'zh-TW', N'序 號'),

  (N'子项目', 'en', N'Sub-project'), (N'子项目', 'ja', N'サブプロジェクト'), (N'子项目', 'ko', N'하위 프로젝트'),
  (N'子项目', 'es', N'Subproyecto'), (N'子项目', 'fr', N'Sous-projet'), (N'子项目', 'de', N'Teilprojekt'),
  (N'子项目', 'ru', N'Подпроект'), (N'子项目', 'vi', N'Tiểu dự án'),
  (N'子项目', 'th', N'โครงการย่อย'), (N'子项目', 'zh-TW', N'子專案'),

  (N'炭棒内孔要求', 'en', N'Rod Bore Requirement'), (N'炭棒内孔要求', 'ja', N'炭棒内孔径要件'),
  (N'炭棒内孔要求', 'ko', N'탄소봉 내경 요구'),      (N'炭棒内孔要求', 'es', N'Requisito de diámetro interior'),
  (N'炭棒内孔要求', 'fr', N'Exigence d''alésage'), (N'炭棒内孔要求', 'de', N'Innenbohrungsanforderung'),
  (N'炭棒内孔要求', 'ru', N'Требование к внутреннему отверстию'), (N'炭棒内孔要求', 'vi', N'Yêu cầu lỗ trong thanh'),
  (N'炭棒内孔要求', 'th', N'ข้อกำหนดรูในแท่งคาร์บอน'), (N'炭棒内孔要求', 'zh-TW', N'炭棒內孔要求'),

  -- ═══ B. 改过 label 的字段(旧 label 的译名可能已在,这里补新 label 的) ═══
  (N'主要性能描述', 'en', N'Main Performance Description'), (N'主要性能描述', 'ja', N'主要性能記述'),
  (N'主要性能描述', 'ko', N'주요 성능 설명'),        (N'主要性能描述', 'es', N'Descripción del rendimiento principal'),
  (N'主要性能描述', 'fr', N'Description des performances principales'), (N'主要性能描述', 'de', N'Beschreibung der Hauptleistung'),
  (N'主要性能描述', 'ru', N'Описание основных характеристик'), (N'主要性能描述', 'vi', N'Mô tả hiệu suất chính'),
  (N'主要性能描述', 'th', N'คำอธิบายสมรรถนะหลัก'),    (N'主要性能描述', 'zh-TW', N'主要性能描述'),

  (N'产品负责人', 'en', N'Product Owner'), (N'产品负责人', 'ja', N'製品責任者'), (N'产品负责人', 'ko', N'제품 책임자'),
  (N'产品负责人', 'es', N'Responsable del producto'), (N'产品负责人', 'fr', N'Responsable produit'),
  (N'产品负责人', 'de', N'Produktverantwortlicher'), (N'产品负责人', 'ru', N'Ответственный за изделие'),
  (N'产品负责人', 'vi', N'Người phụ trách sản phẩm'), (N'产品负责人', 'th', N'ผู้รับผิดชอบผลิตภัณฑ์'),
  (N'产品负责人', 'zh-TW', N'產品負責人'),

  (N'客户名称', 'en', N'Customer Name'), (N'客户名称', 'ja', N'顧客名'), (N'客户名称', 'ko', N'고객명'),
  (N'客户名称', 'es', N'Nombre del cliente'), (N'客户名称', 'fr', N'Nom du client'), (N'客户名称', 'de', N'Kundenname'),
  (N'客户名称', 'ru', N'Наименование клиента'), (N'客户名称', 'vi', N'Tên khách hàng'),
  (N'客户名称', 'th', N'ชื่อลูกค้า'), (N'客户名称', 'zh-TW', N'客戶名稱'),

  (N'物料名称', 'en', N'Material Name'), (N'物料名称', 'ja', N'材料名'), (N'物料名称', 'ko', N'자재명'),
  (N'物料名称', 'es', N'Nombre del material'), (N'物料名称', 'fr', N'Nom du matériau'), (N'物料名称', 'de', N'Materialname'),
  (N'物料名称', 'ru', N'Наименование материала'), (N'物料名称', 'vi', N'Tên vật tư'),
  (N'物料名称', 'th', N'ชื่อวัสดุ'), (N'物料名称', 'zh-TW', N'物料名稱'),

  (N'表单管理人', 'en', N'Form Administrator'), (N'表单管理人', 'ja', N'様式管理者'), (N'表单管理人', 'ko', N'양식 관리자'),
  (N'表单管理人', 'es', N'Administrador del formulario'), (N'表单管理人', 'fr', N'Gestionnaire de formulaire'),
  (N'表单管理人', 'de', N'Formularverwalter'), (N'表单管理人', 'ru', N'Администратор формы'),
  (N'表单管理人', 'vi', N'Người quản lý biểu mẫu'), (N'表单管理人', 'th', N'ผู้ดูแลแบบฟอร์ม'),
  (N'表单管理人', 'zh-TW', N'表單管理人'),

  (N'检验项目', 'en', N'Inspection Item'), (N'检验项目', 'ja', N'検査項目'), (N'检验项目', 'ko', N'검사 항목'),
  (N'检验项目', 'es', N'Ítem de inspección'), (N'检验项目', 'fr', N'Poste d''inspection'), (N'检验项目', 'de', N'Prüfposition'),
  (N'检验项目', 'ru', N'Пункт контроля'), (N'检验项目', 'vi', N'Hạng mục kiểm tra'),
  (N'检验项目', 'th', N'รายการตรวจสอบ'), (N'检验项目', 'zh-TW', N'檢驗項目'),

  (N'检验要求', 'en', N'Inspection Requirement'), (N'检验要求', 'ja', N'検査要件'), (N'检验要求', 'ko', N'검사 요구사항'),
  (N'检验要求', 'es', N'Requisito de inspección'), (N'检验要求', 'fr', N'Exigence d''inspection'),
  (N'检验要求', 'de', N'Prüfanforderung'), (N'检验要求', 'ru', N'Требование контроля'),
  (N'检验要求', 'vi', N'Yêu cầu kiểm tra'), (N'检验要求', 'th', N'ข้อกำหนดการตรวจสอบ'),
  (N'检验要求', 'zh-TW', N'檢驗要求')
) AS v(ref_key, locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = 'field' AND t.ref_key = v.ref_key AND t.locale = v.locale);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 3. RD_PROGRESS「项目层级 → 项目定级」改 label 的补译
--    ⚠ RD_PROGRESS 的 18 列重构在 Phase 2 执行;此处先备译名(改 label 时即命中)
-- ═══════════════════════════════════════════════════════════════════
INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT 'field', N'项目定级', v.locale, v.text, 'manual'
FROM (VALUES
  ('en', N'Project Grade'), ('ja', N'プロジェクト等級'), ('ko', N'프로젝트 등급'),
  ('es', N'Grado del proyecto'), ('fr', N'Niveau de projet'), ('de', N'Projektstufe'),
  ('ru', N'Категория проекта'), ('vi', N'Cấp dự án'), ('th', N'ระดับโครงการ'), ('zh-TW', N'專案定級')
) AS v(locale, text)
WHERE NOT EXISTS (SELECT 1 FROM yj_translation t
                  WHERE t.scope = 'field' AND t.ref_key = N'项目定级' AND t.locale = v.locale);
GO

-- ═══════════════════════════════════════════════════════════════════
-- 4. 核对:本脚本覆盖范围的译名落库情况(缺失即列出)
-- ═══════════════════════════════════════════════════════════════════
SELECT t.ref_key, COUNT(*) AS locales
FROM yj_translation t
WHERE t.scope = 'field' AND t.ref_key IN (
  N'客户项目名称', N'产品管控等级', N'产品功能类别', N'编辑人',
  N'审核人（一级审核）', N'审核人（二级审核）', N'应用场景',
  N'客户项目代号', N'样品编号', N'是否受控', N'受控日期', N'序 号',
  N'子项目', N'炭棒内孔要求', N'主要性能描述', N'产品负责人',
  N'客户名称', N'物料名称', N'表单管理人', N'检验项目', N'检验要求', N'项目定级')
GROUP BY t.ref_key
ORDER BY t.ref_key;
GO

PRINT N'i18n-rd-2026-design.sql 完成';
GO
