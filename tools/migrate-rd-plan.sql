-- migrate-rd-plan.sql — 项目实施计划(二三级项目)文件类文书面板(RD_PLAN)
-- 版式对齐《项目(二三级)实施计划》原图:公司头/YJ-XS002/右上信息表/8 行内容(无虚列)/负责人+编制日期签名行
-- 复用:doc 模式流程 + 保存即归档 + 删除申请审批(文件类,DOC_ARCHIVE_PANELS)
SET NOCOUNT ON;
-- 主表(建表如无 DDL 权限则跳过,由管理员执行)
BEGIN TRY
IF OBJECT_ID('rd_plan') IS NULL CREATE TABLE rd_plan (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [项目名称] nvarchar(100) NULL,
  [项目定级] nvarchar(60) NULL,
  [测试内容] nvarchar(500) NULL,
  [测试产品打样要求] nvarchar(500) NULL,
  [测试目标] nvarchar(100) NULL,
  [测试条件] nvarchar(500) NULL,
  [测试方法] nvarchar(500) NULL,
  [测试标准] nvarchar(500) NULL,
  [测试计划] nvarchar(1000) NULL,
  [阶段1] nvarchar(500) NULL, [阶段2] nvarchar(500) NULL, [阶段3] nvarchar(500) NULL, [阶段4] nvarchar(500) NULL, [阶段5] nvarchar(500) NULL,
  [阶段6] nvarchar(500) NULL, [阶段7] nvarchar(500) NULL, [阶段8] nvarchar(500) NULL, [阶段9] nvarchar(500) NULL, [阶段10] nvarchar(500) NULL,
  [负责人] nvarchar(50) NULL,
  [编制日期] nvarchar(20) NULL,
  [文件管理人] nvarchar(50) NULL,
  [密级] nvarchar(20) NOT NULL DEFAULT N'保密',
  [文件使用范围] nvarchar(50) NOT NULL DEFAULT N'公司内',
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_rd_plan_docno DEFAULT N'YJ-XS002',
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
END TRY
BEGIN CATCH
  PRINT 'rd_plan 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
-- 恒空明细表(doc 模式 line_table;保存缺席软删 UPDATE 需物理表)
BEGIN TRY
IF OBJECT_ID('rd_plan_detail') IS NULL CREATE TABLE rd_plan_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
END TRY
BEGIN CATCH
  PRINT 'rd_plan_detail 表创建跳过(无 DDL 权限,由管理员执行)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_PLAN') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('RD_PLAN', N'项目实施计划', N'单据', 'doc', 'rd_plan_detail', 'rd_plan', N'单据编号', N'id', N'单据编号', N'LXB', N'单据日期', 20, 'items', N'研发管理');
GO
-- 字段(全部 header 位;文书特例按原图排版;密级/范围下拉;文档编号 hidden)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'项目名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'项目名称', N'项目名称', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 180, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'项目定级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'项目定级', N'项目定级', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试内容') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试内容', N'测试内容', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试产品打样要求') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试产品打样要求', N'测试产品打样要求', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试目标') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试目标', N'测试目标', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试条件') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试条件', N'测试条件', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试方法') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试方法', N'测试方法', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试标准') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试标准', N'测试标准', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试计划') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'测试计划', N'测试计划', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'负责人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'负责人', N'负责人', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'编制日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'编制日期', N'编制日期', N'日期', NULL, NULL, NULL, NULL, N'header', 130, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'文件管理人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'文件管理人', N'文件管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'密级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 150, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'文件使用范围') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'文件使用范围', N'文件使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''公司内''),(N''客户项目组''),(N''双方项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 160, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 170, 120, 1, 0, 1, 1);
GO
-- 测试计划:10 个阶段框(前端开关显示/隐藏,按实际显示导出);测试计划整列字段降为 hidden,阶段1..10 为隐藏字段
BEGIN TRY
  IF COL_LENGTH('rd_plan','阶段1') IS NULL
    ALTER TABLE rd_plan ADD [阶段1] nvarchar(500) NULL, [阶段2] nvarchar(500) NULL, [阶段3] nvarchar(500) NULL, [阶段4] nvarchar(500) NULL, [阶段5] nvarchar(500) NULL, [阶段6] nvarchar(500) NULL, [阶段7] nvarchar(500) NULL, [阶段8] nvarchar(500) NULL, [阶段9] nvarchar(500) NULL, [阶段10] nvarchar(500) NULL;
END TRY
BEGIN CATCH
  PRINT '阶段1..10 列已存在或无 DDL 权限(管理员执行 ALTER TABLE);';
END CATCH
GO
IF EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'测试计划') UPDATE yj_field SET hidden=1 WHERE panel_code='RD_PLAN' AND col_name=N'测试计划';
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段1') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段1', N'阶段1', N'文本', NULL, NULL, NULL, NULL, N'header', 111, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段2') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段2', N'阶段2', N'文本', NULL, NULL, NULL, NULL, N'header', 112, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段3') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段3', N'阶段3', N'文本', NULL, NULL, NULL, NULL, N'header', 113, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段4') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段4', N'阶段4', N'文本', NULL, NULL, NULL, NULL, N'header', 114, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段5') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段5', N'阶段5', N'文本', NULL, NULL, NULL, NULL, N'header', 115, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段6') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段6', N'阶段6', N'文本', NULL, NULL, NULL, NULL, N'header', 116, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段7') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段7', N'阶段7', N'文本', NULL, NULL, NULL, NULL, N'header', 117, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段8') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段8', N'阶段8', N'文本', NULL, NULL, NULL, NULL, N'header', 118, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段9') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段9', N'阶段9', N'文本', NULL, NULL, NULL, NULL, N'header', 119, 200, 1, 0, 1, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_PLAN' AND col_name=N'阶段10') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_PLAN', N'阶段10', N'阶段10', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 200, 1, 0, 1, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'项目实施计划' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'项目实施计划', 'en', N'Project Implementation Plan', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目定级' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目定级', 'en', N'Project Level', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试内容' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试内容', 'en', N'Test Content', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试产品打样要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试产品打样要求', 'en', N'Test Product Sample Requirements', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试目标' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试目标', 'en', N'Test Objectives', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试条件' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试条件', 'en', N'Test Conditions', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试方法' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试方法', 'en', N'Test Method', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试标准' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试标准', 'en', N'Test Standard', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'测试计划' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'测试计划', 'en', N'Test Plan', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'编制日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'编制日期', 'en', N'Compilation Date', 'manual');
