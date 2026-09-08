-- migrate-rd-progress.sql — 项目进度查询(产品开发二三四级项目控制列表)主从面板(RD_PROGRESS)
-- 主项目(表头:项目名称可填/可参照项目实施计划,选取自动带回实施计划同名字段)+ 子项目明细(可任意新增)
SET NOCOUNT ON;
BEGIN TRY
IF OBJECT_ID('rd_progress') IS NULL CREATE TABLE rd_progress (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [项目名称] nvarchar(200) NOT NULL,
  [项目层级] nvarchar(20) NOT NULL DEFAULT N'一级',
  [项目定级] nvarchar(60) NULL,
  [测试内容] nvarchar(500) NULL,
  [测试产品打样要求] nvarchar(500) NULL,
  [测试目标] nvarchar(100) NULL,
  [测试条件] nvarchar(500) NULL,
  [测试方法] nvarchar(500) NULL,
  [测试标准] nvarchar(500) NULL,
  [密级] nvarchar(20) NULL,
  [文件使用范围] nvarchar(50) NULL,
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_rd_progress_docno DEFAULT N'YJ-XS002',
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_progress 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
BEGIN TRY
IF OBJECT_ID('rd_progress_detail') IS NULL CREATE TABLE rd_progress_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [子项目/尺寸] nvarchar(100) NULL,
  [说明] nvarchar(200) NULL,
  [内容] nvarchar(500) NULL,
  [项目级] nvarchar(50) NULL,
  [项目负责] nvarchar(50) NULL,
  [实施进度] nvarchar(200) NULL,
  [里程完成] nvarchar(20) NULL,
  [状态] nvarchar(20) NULL,
  [测试员] nvarchar(50) NULL,
  [谁来批准] nvarchar(50) NULL,
  [谁来检验] nvarchar(50) NULL,
  [未批准原因] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_progress_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_PROGRESS') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('RD_PROGRESS', N'项目进度查询', N'单据', 'doc', 'rd_progress_detail', 'rd_progress', N'单据编号', N'id', N'单据编号', N'LXJ', N'单据日期', 20, 'items', N'研发管理');
GO
-- 查询字段(项目名称参照实施计划)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'项目名称' AND place=N'query') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'项目名称', N'项目名称', N'参照', NULL, 'RD_PLAN', N'项目名称', N'项目名称', N'query', 10, 200, 0, 0, 0, 1);
-- 表头字段
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1);
-- 项目名称:可填写(≤20条参照下拉 allow-create)或选择项目实施计划(选取后自动带回同名字段)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'项目名称' AND place=N'header') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'项目名称', N'项目名称', N'参照', NULL, 'RD_PLAN', N'项目名称', N'项目名称', N'header', 30, 240, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'项目层级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'项目层级', N'项目(一/二级)', N'下拉框', N'SELECT v FROM (VALUES (N''一二级''),(N''二级''),(N''三级''),(N''四级'')) AS t(v)', NULL, NULL, NULL, N'header', 40, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'项目定级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'项目定级', N'项目定级', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试内容') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试内容', N'测试内容', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试产品打样要求') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试产品打样要求', N'测试产品打样要求', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试目标') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试目标', N'测试目标', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试条件') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试条件', N'测试条件', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试方法') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试标准') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'密级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 115, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'文件使用范围') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'文件使用范围', N'文件使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''工程技术中心''),(N''公司内''),(N''客户项目组''),(N''双方项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 116, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 117, 120, 1, 0, 1, 1);
GO
-- 明细字段(子项目行)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'子项目/尺寸') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'子项目/尺寸', N'子项目/尺寸', N'文本', NULL, NULL, NULL, NULL, N'detail', 10, 150, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'说明') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'说明', N'说明', N'文本', NULL, NULL, NULL, NULL, N'detail', 20, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'内容') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'内容', N'内容', N'文本', NULL, NULL, NULL, NULL, N'detail', 30, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'项目级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'项目级', N'项目级', N'文本', NULL, NULL, NULL, NULL, N'detail', 40, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'项目负责') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'项目负责', N'项目负责', N'文本', NULL, NULL, NULL, NULL, N'detail', 50, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'实施进度') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'实施进度', N'实施进度', N'文本', NULL, NULL, NULL, NULL, N'detail', 60, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'里程完成') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'里程完成', N'里程完成', N'下拉框', N'SELECT v FROM (VALUES (N''100%''),(N''90%''),(N''80%''),(N''70%''),(N''60%''),(N''50%''),(N''40%''),(N''30%''),(N''20%''),(N''10%''),(N''0%'')) AS t(v)', NULL, NULL, NULL, N'detail', 70, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'状态', N'状态', N'下拉框', N'SELECT v FROM (VALUES (N''待启动''),(N''进行中''),(N''测试中''),(N''已完成测试''),(N''已完成''),(N''有待批准''),(N''未批准'')) AS t(v)', NULL, NULL, NULL, N'detail', 80, 110, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'测试员') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'测试员', N'测试员', N'文本', NULL, NULL, NULL, NULL, N'detail', 90, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'谁来批准') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'谁来批准', N'谁来批准', N'文本', NULL, NULL, NULL, NULL, N'detail', 100, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'谁来检验') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'谁来检验', N'谁来检验', N'文本', NULL, NULL, NULL, NULL, N'detail', 110, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PROGRESS' AND col_name=N'未批准原因') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PROGRESS', N'未批准原因', N'未批准原因', N'文本', NULL, NULL, NULL, NULL, N'detail', 120, 200, 1, 0, 0, 1);
GO
-- 译名(面板名已有全局译名;新字段补充 en,其它语言机翻兜底)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目层级' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目层级', 'en', N'Project Level Tier', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'子项目/尺寸' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'子项目/尺寸', 'en', N'Sub-project / Size', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目级' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目级', 'en', N'Project Grade', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目负责' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目负责', 'en', N'Project Owner', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实施进度' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实施进度', 'en', N'Progress', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'里程完成' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'里程完成', 'en', N'Milestone %', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试员' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试员', 'en', N'Tester', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'谁来批准' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'谁来批准', 'en', N'Approved By', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'谁来检验' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'谁来检验', 'en', N'Inspected By', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'未批准原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'未批准原因', 'en', N'Rejection Reason', 'manual');
