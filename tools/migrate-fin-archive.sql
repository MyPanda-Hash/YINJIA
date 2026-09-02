-- migrate-fin-archive.sql — 财务新档案:税别资料/费用类别/会计科目(均为 archive 单单据面板)
SET NOCOUNT ON;
-- ===== 1) 建表 =====
IF OBJECT_ID('bd_tax_type') IS NULL CREATE TABLE bd_tax_type (
  id int IDENTITY(1,1) PRIMARY KEY,
  [税别编码] nvarchar(200) NOT NULL,
  [税别名称] nvarchar(200) NOT NULL,
  [税率%] decimal(10,4) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('bd_expense_type') IS NULL CREATE TABLE bd_expense_type (
  id int IDENTITY(1,1) PRIMARY KEY,
  [费用类别编码] nvarchar(200) NOT NULL,
  [费用类别名称] nvarchar(200) NOT NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('bd_account') IS NULL CREATE TABLE bd_account (
  id int IDENTITY(1,1) PRIMARY KEY,
  [科目编码] nvarchar(200) NOT NULL,
  [科目名称] nvarchar(200) NOT NULL,
  [科目类别] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [状态] nvarchar(10) NOT NULL DEFAULT N'启用',
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
-- ===== 2) 面板注册(yj_panel) =====
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FIN_TAX') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('FIN_TAX', N'税别资料', N'基础设置', 'archive', 'bd_tax_type', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'taxes', N'基础档案');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FIN_EXP') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('FIN_EXP', N'费用类别', N'基础设置', 'archive', 'bd_expense_type', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'expenses', N'基础档案');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'FIN_ACC') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('FIN_ACC', N'会计科目', N'基础设置', 'archive', 'bd_account', NULL, NULL, 'id', NULL, NULL, NULL, 100, 'accounts', N'基础档案');
GO
-- ===== 3) 字段注册(yj_field) =====
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_TAX' AND col_name=N'税别编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_TAX', N'税别编码', N'税别编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_TAX' AND col_name=N'税别名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_TAX', N'税别名称', N'税别名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 160, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_TAX' AND col_name=N'税率%') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_TAX', N'税率%', N'税率%', N'小数', NULL, NULL, NULL, NULL, N'detail', 30, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_TAX' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_TAX', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 220, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_EXP' AND col_name=N'费用类别编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_EXP', N'费用类别编码', N'费用类别编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_EXP' AND col_name=N'费用类别名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_EXP', N'费用类别名称', N'费用类别名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 160, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_EXP' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_EXP', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 220, 1, 0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'科目编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_ACC', N'科目编码', N'科目编码', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 140, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'科目名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_ACC', N'科目名称', N'科目名称', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'科目类别') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_ACC', N'科目类别', N'科目类别', N'下拉框', N'SELECT v FROM (VALUES (N''资产''),(N''负债''),(N''权益''),(N''成本''),(N''损益'')) AS t(v)', NULL, NULL, NULL, N'detail', 30, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FIN_ACC' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FIN_ACC', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 220, 1, 0, 0, 1);
GO
-- ===== 4) 英语译名(yj_translation;其他语言由实时机翻自动补齐) =====
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'税别资料' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'税别资料', 'en', N'Tax Type', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'费用类别' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'费用类别', 'en', N'Expense Category', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'会计科目' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'会计科目', 'en', N'Account Subject', 'manual');

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税别编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税别编码', 'en', N'Tax Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税别名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税别名称', 'en', N'Tax Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'税率%' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'税率%', 'en', N'Tax Rate %', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'费用类别编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'费用类别编码', 'en', N'Expense Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'费用类别名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'费用类别名称', 'en', N'Expense Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'科目编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'科目编码', 'en', N'Account Code', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'科目名称' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'科目名称', 'en', N'Account Name', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'科目类别' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'科目类别', 'en', N'Account Category', 'manual');
