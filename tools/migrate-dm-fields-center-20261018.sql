-- =====================================================================================
-- migrate-dm-fields-center-20261018.sql — 数据建模 / 字段管理 面板 + ERP导入日志迁入
--
-- 用户口径(2026-10-18):
--   ① 侧边栏新增一级目录「数据建模」,其下先放两样:字段管理、ERP导入日志、数据字典;
--   ② 「把 ERP导入日志 从系统管理迁移到数据建模里面去」;
--   ③ 「去关联金蝶账号的数据写入,先把数据补充完整」(数据由 _seed-erplg-from-kingdee.mjs 现场读金蝶后写入)。
--
-- 本源文件做的事(幂等,可重复执行):
--   A. 面板分类:ERPLG / ERPLG_ROW 的 category 与 module_group 由「基础档案」改为「数据建模」;
--   B. 新建面板 FIELDMGR(字段管理,archive / yj_field 自身即为数据源)—— 「加面板=插行」;
--      * 它把 yj_field 的元数据(字段名/承载列/位置/顺序/必填/隐藏/字典…)搬上界面,
--        即「数据建模」的第一块基座:看得到、改得动整个系统的字段模型;
--      * 只读核对 + 在场编辑(保存走通用档案保存,逐行 upsert,不会因筛选/截断误删 —— 见
--        ButtonService.saveArchive 的"只提交改动行"口径);
--      * yj_field 表没有 asp_cancel 列 ⇒ 该面板不做"行内删除",删除字段仍走接口/迁移脚本。
--   C. 字段的多语言词条(yj_translation:panel + field),en/ja/ko/es/fr/de/ru/vi/th/zh-TW 全量,
--      口径见 AGENTS.md「多语言强制规范」。
--
-- 执行:tools\DbSync(两账套各跑一次)
-- 回退:UPDATE yj_panel SET category=N'基础档案', module_group=N'基础档案' WHERE panel_code IN ('ERPLG','ERPLG_ROW');
--       DELETE FROM yj_field WHERE panel_code='FIELDMGR'; DELETE FROM yj_panel WHERE panel_code='FIELDMGR';
-- =====================================================================================
SET NOCOUNT ON;
PRINT N'== migrate-dm-fields-center-20261018 ==';

-- ────────────────────────────── A. ERP导入日志迁入「数据建模」 ──────────────────────────────
UPDATE yj_panel
   SET category = N'数据建模', module_group = N'数据建模'
 WHERE panel_code IN ('ERPLG', 'ERPLG_ROW')
   AND (ISNULL(category, N'') <> N'数据建模' OR ISNULL(module_group, N'') <> N'数据建模');
PRINT N'  A. ERPLG / ERPLG_ROW → category/module_group = 数据建模';

-- ────────────────────────────── B. 面板 FIELDMGR(字段管理) ──────────────────────────────
-- 数据源 = yj_field 自身(整张字段元数据表),mode=archive:一张虚拟单承载全表记录。
-- pk_col=id / code_col=panel_code(yj_field 的**真实列名**,不是显示名「面板编码」—— code_col 是物理列,
-- 派生列「面板名称」就靠它关联 yj_panel);date_col 留空(按 id 排序),page_size=50。
-- ⚠ 2026-10-18 实测踩到两次,记在这里:① col_name 曾是展示名 ⇒「列名 '面板编码' 无效」;
--   ② code_col 曾写成 N'字段名' ⇒ 派生列关联成 `pn.panel_code = t.[字段名]` ⇒ 同一条报错。
--   结论:yj_field 面板里**凡是给 SQL 用的名字**(col_name / code_col / pk_col)一律写物理列名。
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FIELDMGR')
INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col,
                      code_col, prefix, date_col, page_size, detail_key, config, config_at, module_group, panel_name_en)
VALUES ('FIELDMGR', N'字段管理', N'数据建模', N'archive', N'yj_field', NULL, NULL, N'id', N'panel_code', NULL,
        N'id', 50, N'items', NULL, NULL, N'数据建模', N'Field Management');
PRINT N'  B. 面板 FIELDMGR(字段管理)';

-- 幂等修正(2026-10-18,首版把 code_col 写成了显示名 N'字段名'):已存在的行也要改回物理列名,
-- 否则派生列「面板名称」的 LEFT JOIN 会变成 pn.panel_code = t.[字段名](列不存在)。
UPDATE yj_panel SET code_col = N'panel_code'
 WHERE panel_code = 'FIELDMGR' AND ISNULL(code_col, N'') <> N'panel_code';

-- 字段登记
-- ⚠ 口径(2026-10-18 实测踩到):yj_field.col_name 是**物理列**,label 是**显示名**。
--   数据源是 yj_field 自己,所以这里的 col_name 必须写 yj_field 的真实列名
--   (当初写成「面板编码/面板名称」这类展示名 ⇒ 列表一打开就报「列名 '面板编码' 无效」)。
--   面板编码 → panel_code,面板名称 → 由面板头 JOIN 带出(见下方同批更新)。
DECLARE @f TABLE (col_name sysname, label nvarchar(120), data_type nvarchar(40), place varchar(60),
                  seq int, width int, editable bit, required bit, hidden bit, dict_sql nvarchar(1000));
INSERT INTO @f (col_name, label, data_type, place, seq, width, editable, required, hidden, dict_sql) VALUES
 (N'panel_code', N'面板编码', N'文本',        N'query,detail', 10, 130, 1, 0, 0, NULL),
 (N'panel_name', N'面板名称', N'文本',        N'query,detail', 20, 150, 0, 0, 0, NULL),   -- 派生列:表上无此物理列,由 panel_code 关联 yj_panel 带出
 (N'label',      N'字段名',   N'文本',        N'query,detail', 30, 140, 1, 1, 0, NULL),
 (N'label_en',   N'英文名',   N'文本',        N'detail',       40, 140, 1, 0, 0, NULL),
 (N'col_name',   N'承载列',   N'文本',        N'query,detail', 50, 120, 0, 0, 0, NULL),
 (N'data_type',  N'类型',     N'下拉框',      N'detail',       60,  90, 1, 0, 0,
    N'SELECT v FROM (VALUES (N''文本''),(N''整数''),(N''小数''),(N''日期''),(N''下拉框''),(N''是否''),(N''参照'')) AS t(v)'),
 (N'place',      N'位置',     N'文本',        N'query,detail', 70, 120, 1, 0, 0, NULL),
 (N'seq',        N'顺序',     N'整数',        N'detail',       80,  70, 1, 0, 0, NULL),
 (N'width',      N'列宽',     N'整数',        N'detail',       90,  70, 1, 0, 0, NULL),
 (N'editable',   N'可编辑',   N'是否',        N'detail',      100,  70, 1, 0, 0, NULL),
 (N'required',   N'必填',     N'是否',        N'detail',      110,  60, 1, 0, 0, NULL),
 (N'hidden',     N'隐藏',     N'是否',        N'detail',      120,  60, 1, 0, 0, NULL),
 (N'visible',    N'可见',     N'是否',        N'detail',      130,  60, 1, 0, 0, NULL),
 (N'ref_panel',  N'参照面板', N'文本',        N'query,detail', 140, 120, 1, 0, 0, NULL),
 (N'ref_field',  N'参照字段', N'文本',        N'detail',      150, 120, 1, 0, 0, NULL),
 (N'dict_sql',   N'字典SQL',  N'文本',        N'detail',      160, 280, 1, 0, 0, NULL),
 (N'col_group',  N'分组',     N'文本',        N'detail',      170, 100, 1, 0, 0, NULL),
 (N'tab_key',    N'页签',     N'文本',        N'detail',      180, 100, 1, 0, 0, NULL),
 (N'alias',      N'栏名',     N'文本',        N'detail',      190, 120, 1, 0, 0, NULL);

INSERT INTO yj_field (panel_code, col_name, label, label_en, data_type, dict_sql, ref_panel, ref_field,
                      display_field, place, seq, width, editable, required, hidden, visible)
SELECT 'FIELDMGR', f.col_name, f.label, NULL, f.data_type, f.dict_sql, NULL, NULL, NULL,
       f.place, f.seq, f.width, f.editable, f.required, f.hidden, 1
  FROM @f f
 WHERE NOT EXISTS (SELECT 1 FROM yj_field x WHERE x.panel_code = 'FIELDMGR' AND x.col_name = f.col_name);

-- 面板名称:yj_field 表里没有这一列 —— 它是 panel_code 的关联显示名。
-- 先按「同名物理列」口径重写一遍(幂等),再由下面的项统一改成「关联带出」列表:
UPDATE yj_field SET label = f.label, data_type = f.data_type, place = f.place, seq = f.seq,
       width = f.width, editable = f.editable, required = f.required, hidden = f.hidden,
       dict_sql = f.dict_sql, visible = 1
  FROM @f f
 WHERE yj_field.panel_code = 'FIELDMGR' AND yj_field.col_name = f.col_name;
PRINT N'  B. FIELDMGR 字段登记';

-- ────────────────────────────── C. 多语言词条 ──────────────────────────────
DECLARE @t TABLE (scope varchar(20), ref_key nvarchar(120), locale varchar(10), text nvarchar(400));
INSERT INTO @t (scope, ref_key, locale, text) VALUES
 -- 面板名
 ('panel', N'字段管理', 'en',  N'Field Management'), ('panel', N'字段管理', 'zh-TW', N'欄位管理'),
 ('panel', N'字段管理', 'ja',  N'フィールド管理'),  ('panel', N'字段管理', 'ko', N'필드 관리'),
 ('panel', N'字段管理', 'es',  N'Gestión de campos'), ('panel', N'字段管理', 'fr', N'Gestion des champs'),
 ('panel', N'字段管理', 'de',  N'Feldverwaltung'), ('panel', N'字段管理', 'ru', N'Управление полями'),
 ('panel', N'字段管理', 'vi',  N'Quản lý trường'), ('panel', N'字段管理', 'th', N'การจัดการฟิลด์'),
 ('panel', N'ERP导入日志', 'en', N'ERP Import Log'), ('panel', N'ERP导入日志', 'zh-TW', N'ERP匯入日誌'),
 ('panel', N'ERP导入日志', 'ja', N'ERP取込ログ'),   ('panel', N'ERP导入日志', 'ko', N'ERP 가져오기 로그'),
 ('panel', N'ERP导入日志', 'es', N'Registro de importación ERP'), ('panel', N'ERP导入日志', 'fr', N'Journal d''import ERP'),
 ('panel', N'ERP导入日志', 'de', N'ERP-Importprotokoll'), ('panel', N'ERP导入日志', 'ru', N'Журнал импорта ERP'),
 ('panel', N'ERP导入日志', 'vi', N'Nhật ký nhập ERP'), ('panel', N'ERP导入日志', 'th', N'บันทึกการนำเข้า ERP'),
 -- 字段名
 ('field', N'面板编码', 'en', N'Panel code'), ('field', N'面板编码', 'zh-TW', N'面板編碼'),
 ('field', N'面板编码', 'ja', N'パネルコード'), ('field', N'面板编码', 'ko', N'패널 코드'),
 ('field', N'面板编码', 'es', N'Código de panel'), ('field', N'面板编码', 'fr', N'Code du panneau'),
 ('field', N'面板编码', 'de', N'Panelcode'), ('field', N'面板编码', 'ru', N'Код панели'),
 ('field', N'面板编码', 'vi', N'Mã bảng'), ('field', N'面板编码', 'th', N'รหัสแผง'),
 ('field', N'面板名称', 'en', N'Panel name'), ('field', N'面板名称', 'zh-TW', N'面板名稱'),
 ('field', N'面板名称', 'ja', N'パネル名'), ('field', N'面板名称', 'ko', N'패널 이름'),
 ('field', N'面板名称', 'es', N'Nombre del panel'), ('field', N'面板名称', 'fr', N'Nom du panneau'),
 ('field', N'面板名称', 'de', N'Panelname'), ('field', N'面板名称', 'ru', N'Название панели'),
 ('field', N'面板名称', 'vi', N'Tên bảng'), ('field', N'面板名称', 'th', N'ชื่อแผง'),
 ('field', N'字段名', 'en', N'Field name'), ('field', N'字段名', 'zh-TW', N'欄位名稱'),
 ('field', N'字段名', 'ja', N'フィールド名'), ('field', N'字段名', 'ko', N'필드 이름'),
 ('field', N'字段名', 'es', N'Nombre del campo'), ('field', N'字段名', 'fr', N'Nom du champ'),
 ('field', N'字段名', 'de', N'Feldname'), ('field', N'字段名', 'ru', N'Имя поля'),
 ('field', N'字段名', 'vi', N'Tên trường'), ('field', N'字段名', 'th', N'ชื่อฟิลด์'),
 ('field', N'英文名', 'en', N'English name'), ('field', N'英文名', 'zh-TW', N'英文名'),
 ('field', N'英文名', 'ja', N'英語名'), ('field', N'英文名', 'ko', N'영문 이름'),
 ('field', N'英文名', 'es', N'Nombre en inglés'), ('field', N'英文名', 'fr', N'Nom anglais'),
 ('field', N'英文名', 'de', N'Englischer Name'), ('field', N'英文名', 'ru', N'Английское имя'),
 ('field', N'英文名', 'vi', N'Tên tiếng Anh'), ('field', N'英文名', 'th', N'ชื่อภาษาอังกฤษ'),
 ('field', N'承载列', 'en', N'Backing column'), ('field', N'承载列', 'zh-TW', N'承載欄'),
 ('field', N'承载列', 'ja', N'物理カラム'), ('field', N'承载列', 'ko', N'물리 컬럼'),
 ('field', N'承载列', 'es', N'Columna física'), ('field', N'承载列', 'fr', N'Colonne physique'),
 ('field', N'承载列', 'de', N'Physische Spalte'), ('field', N'承载列', 'ru', N'Физический столбец'),
 ('field', N'承载列', 'vi', N'Cột vật lý'), ('field', N'承载列', 'th', N'คอลัมน์จริง'),
 ('field', N'类型', 'en', N'Type'), ('field', N'类型', 'zh-TW', N'類型'),
 ('field', N'类型', 'ja', N'型'), ('field', N'类型', 'ko', N'유형'),
 ('field', N'类型', 'es', N'Tipo'), ('field', N'类型', 'fr', N'Type'),
 ('field', N'类型', 'de', N'Typ'), ('field', N'类型', 'ru', N'Тип'),
 ('field', N'类型', 'vi', N'Loại'), ('field', N'类型', 'th', N'ประเภท'),
 ('field', N'位置', 'en', N'Placement'), ('field', N'位置', 'zh-TW', N'位置'),
 ('field', N'位置', 'ja', N'配置位置'), ('field', N'位置', 'ko', N'배치 위치'),
 ('field', N'位置', 'es', N'Ubicación'), ('field', N'位置', 'fr', N'Emplacement'),
 ('field', N'位置', 'de', N'Position'), ('field', N'位置', 'ru', N'Расположение'),
 ('field', N'位置', 'vi', N'Vị trí'), ('field', N'位置', 'th', N'ตำแหน่ง'),
 ('field', N'顺序', 'en', N'Seq'), ('field', N'顺序', 'zh-TW', N'順序'),
 ('field', N'顺序', 'ja', N'並び順'), ('field', N'顺序', 'ko', N'순서'),
 ('field', N'顺序', 'es', N'Orden'), ('field', N'顺序', 'fr', N'Ordre'),
 ('field', N'顺序', 'de', N'Reihenfolge'), ('field', N'顺序', 'ru', N'Порядок'),
 ('field', N'顺序', 'vi', N'Thứ tự'), ('field', N'顺序', 'th', N'ลำดับ'),
 ('field', N'列宽', 'en', N'Width'), ('field', N'列宽', 'zh-TW', N'欄寬'),
 ('field', N'列宽', 'ja', N'列幅'), ('field', N'列宽', 'ko', N'열 너비'),
 ('field', N'列宽', 'es', N'Ancho'), ('field', N'列宽', 'fr', N'Largeur'),
 ('field', N'列宽', 'de', N'Spaltenbreite'), ('field', N'列宽', 'ru', N'Ширина'),
 ('field', N'列宽', 'vi', N'Độ rộng'), ('field', N'列宽', 'th', N'ความกว้าง'),
 ('field', N'可编辑', 'en', N'Editable'), ('field', N'可编辑', 'zh-TW', N'可編輯'),
 ('field', N'可编辑', 'ja', N'編集可'), ('field', N'可编辑', 'ko', N'편집 가능'),
 ('field', N'可编辑', 'es', N'Editable'), ('field', N'可编辑', 'fr', N'Modifiable'),
 ('field', N'可编辑', 'de', N'Bearbeitbar'), ('field', N'可编辑', 'ru', N'Редактируемое'),
 ('field', N'可编辑', 'vi', N'Có thể sửa'), ('field', N'可编辑', 'th', N'แก้ไขได้'),
 ('field', N'必填', 'en', N'Required'), ('field', N'必填', 'zh-TW', N'必填'),
 ('field', N'必填', 'ja', N'必須'), ('field', N'必填', 'ko', N'필수'),
 ('field', N'必填', 'es', N'Obligatorio'), ('field', N'必填', 'fr', N'Obligatoire'),
 ('field', N'必填', 'de', N'Pflichtfeld'), ('field', N'必填', 'ru', N'Обязательное'),
 ('field', N'必填', 'vi', N'Bắt buộc'), ('field', N'必填', 'th', N'จำเป็น'),
 ('field', N'隐藏', 'en', N'Hidden'), ('field', N'隐藏', 'zh-TW', N'隱藏'),
 ('field', N'隐藏', 'ja', N'非表示'), ('field', N'隐藏', 'ko', N'숨김'),
 ('field', N'隐藏', 'es', N'Oculto'), ('field', N'隐藏', 'fr', N'Masqué'),
 ('field', N'隐藏', 'de', N'Ausgeblendet'), ('field', N'隐藏', 'ru', N'Скрытое'),
 ('field', N'隐藏', 'vi', N'Ẩn'), ('field', N'隐藏', 'th', N'ซ่อน'),
 ('field', N'可见', 'en', N'Visible'), ('field', N'可见', 'zh-TW', N'可見'),
 ('field', N'可见', 'ja', N'表示'), ('field', N'可见', 'ko', N'표시'),
 ('field', N'可见', 'es', N'Visible'), ('field', N'可见', 'fr', N'Visible'),
 ('field', N'可见', 'de', N'Sichtbar'), ('field', N'可见', 'ru', N'Видимое'),
 ('field', N'可见', 'vi', N'Hiển thị'), ('field', N'可见', 'th', N'แสดง'),
 ('field', N'参照面板', 'en', N'Ref. panel'), ('field', N'参照面板', 'zh-TW', N'參照面板'),
 ('field', N'参照面板', 'ja', N'参照パネル'), ('field', N'参照面板', 'ko', N'참조 패널'),
 ('field', N'参照面板', 'es', N'Panel de referencia'), ('field', N'参照面板', 'fr', N'Panneau de référence'),
 ('field', N'参照面板', 'de', N'Referenzpanel'), ('field', N'参照面板', 'ru', N'Панель ссылки'),
 ('field', N'参照面板', 'vi', N'Bảng tham chiếu'), ('field', N'参照面板', 'th', N'แผงอ้างอิง'),
 ('field', N'参照字段', 'en', N'Ref. field'), ('field', N'参照字段', 'zh-TW', N'參照欄位'),
 ('field', N'参照字段', 'ja', N'参照フィールド'), ('field', N'参照字段', 'ko', N'참조 필드'),
 ('field', N'参照字段', 'es', N'Campo de referencia'), ('field', N'参照字段', 'fr', N'Champ de référence'),
 ('field', N'参照字段', 'de', N'Referenzfeld'), ('field', N'参照字段', 'ru', N'Поле ссылки'),
 ('field', N'参照字段', 'vi', N'Trường tham chiếu'), ('field', N'参照字段', 'th', N'ฟิลด์อ้างอิง'),
 ('field', N'分组', 'en', N'Group'), ('field', N'分组', 'zh-TW', N'分組'),
 ('field', N'分组', 'ja', N'グループ'), ('field', N'分组', 'ko', N'그룹'),
 ('field', N'分组', 'es', N'Grupo'), ('field', N'分组', 'fr', N'Groupe'),
 ('field', N'分组', 'de', N'Gruppe'), ('field', N'分组', 'ru', N'Группа'),
 ('field', N'分组', 'vi', N'Nhóm'), ('field', N'分组', 'th', N'กลุ่ม'),
 ('field', N'页签', 'en', N'Tab'), ('field', N'页签', 'zh-TW', N'頁籤'),
 ('field', N'页签', 'ja', N'タブ'), ('field', N'页签', 'ko', N'탭'),
 ('field', N'页签', 'es', N'Pestaña'), ('field', N'页签', 'fr', N'Onglet'),
 ('field', N'页签', 'de', N'Registerkarte'), ('field', N'页签', 'ru', N'Вкладка'),
 ('field', N'页签', 'vi', N'Tab'), ('field', N'页签', 'th', N'แท็บ'),
 ('field', N'栏名', 'en', N'Column alias'), ('field', N'栏名', 'zh-TW', N'欄名'),
 ('field', N'栏名', 'ja', N'列名'), ('field', N'栏名', 'ko', N'열 이름'),
 ('field', N'栏名', 'es', N'Alias de columna'), ('field', N'栏名', 'fr', N'Alias de colonne'),
 ('field', N'栏名', 'de', N'Spaltenalias'), ('field', N'栏名', 'ru', N'Псевдоним столбца'),
 ('field', N'栏名', 'vi', N'Tên cột'), ('field', N'栏名', 'th', N'ชื่อคอลัมน์');

INSERT INTO yj_translation (scope, ref_key, locale, text, source)
SELECT t.scope, t.ref_key, t.locale, t.text, 'manual'
  FROM @t t
 WHERE NOT EXISTS (SELECT 1 FROM yj_translation x
                    WHERE x.scope = t.scope AND x.ref_key = t.ref_key AND x.locale = t.locale);
PRINT N'  C. 多语言词条';

-- ────────────────────────────── 自检 ──────────────────────────────
SELECT (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'FIELDMGR') AS FIELDMGR字段数,
       (SELECT COUNT(*) FROM yj_panel WHERE panel_code IN ('ERPLG','ERPLG_ROW') AND module_group = N'数据建模') AS ERPLG归属数据建模;
PRINT N'== 完成 ==';
