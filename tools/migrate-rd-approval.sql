-- migrate-rd-approval.sql — 立项申请表(二三级项目)唯一面板:文书式 doc 单据
-- 样式:表头(公司名/文档号/文件管理人/密级/文件使用范围)+ 8 项内容区(可写字数限制)+ 底部签名区
-- 复用:doc 模式审批流/流水号/导出打印等引擎逻辑(channel: 前端 RD_APPROVAL 文书特例渲染)
SET NOCOUNT ON;
IF OBJECT_ID('rd_approval') IS NULL CREATE TABLE rd_approval (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [客户名] nvarchar(100) NULL,
  [立项背景] nvarchar(1000) NULL,
  [机型及应用位置] nvarchar(200) NULL,
  [滤芯炭棒规格或结构] nvarchar(400) NULL,
  [项目开发目标] nvarchar(1000) NULL,
  [项目输出] nvarchar(400) NULL,
  [开发周期要求] nvarchar(200) NULL,
  [其它要求] nvarchar(1000) NULL,
  [申请立项人] nvarchar(50) NULL,
  [申请立项日期] nvarchar(20) NULL,
  [文件管理人] nvarchar(50) NULL,
  [密级] nvarchar(20) NOT NULL DEFAULT N'保密',
  [文件使用范围] nvarchar(50) NOT NULL DEFAULT N'公司内',
  [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_rd_approval_docno DEFAULT N'YJ-XS002',
  [备注] nvarchar(500) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
ELSE IF COL_LENGTH('rd_approval','文档编号') IS NULL ALTER TABLE rd_approval ADD [文档编号] nvarchar(30) NOT NULL CONSTRAINT DF_rd_approval_docno DEFAULT N'YJ-XS002';
GO
-- 恒空明细表(doc 模式要求 line_table;立项申请无明细,查询取空集)。
-- 注意:必须用物理空表而非视图——doc 保存会执行缺席软删 UPDATE(asp_cancel),视图含派生/常量域不可更新(报 4406)。
-- 早前版本使用 v_rd_approval_detail 视图,已部署库请以管理员(-E)执行:
--   DROP VIEW v_rd_approval_detail; EXEC('CREATE TABLE rd_approval_detail (id int IDENTITY(1,1) PRIMARY KEY, [单据编号] nvarchar(60) NULL, asp_cancel char(1) NULL DEFAULT N''N'', asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_time2 datetime2 NULL)');
IF OBJECT_ID('rd_approval_detail') IS NULL CREATE TABLE rd_approval_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NULL,
  asp_cancel char(1) NULL DEFAULT 'N',
  asp_user1 nvarchar(50) NULL, asp_user2 nvarchar(50) NULL,
  asp_time1 datetime2 NULL, asp_time2 datetime2 NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'RD_APPROVAL') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('RD_APPROVAL', N'立项申请', N'单据', 'doc', 'rd_approval_detail', 'rd_approval', N'单据编号', N'id', N'单据编号', N'LXA', N'单据日期', 20, 'items', N'研发管理');
ELSE IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code='RD_APPROVAL' AND line_table=N'rd_approval_detail') UPDATE yj_panel SET line_table=N'rd_approval_detail' WHERE panel_code='RD_APPROVAL';
GO
-- 文件类面板(文书式)保存即归档:yj_doc_status 增加 archived 标记(无权限环境跳过,由管理员执行)
BEGIN TRY
  IF COL_LENGTH('yj_doc_status','archived') IS NULL ALTER TABLE yj_doc_status ADD archived char(1) NULL DEFAULT 'N';
END TRY
BEGIN CATCH
  PRINT 'yj_doc_status.archived 列已存在或无 DDL 权限(管理员执行:ALTER TABLE yj_doc_status ADD archived char(1) NULL DEFAULT ''N'');';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'客户名') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'客户名', N'客户名', N'文本', NULL, NULL, NULL, NULL, N'header', 30, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'立项背景') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'立项背景', N'立项背景', N'文本', NULL, NULL, NULL, NULL, N'header', 40, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'机型及应用位置') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'机型及应用位置', N'机型及应用位置', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'滤芯炭棒规格或结构') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'滤芯炭棒规格或结构', N'滤芯/炭棒规格或结构', N'文本', NULL, NULL, NULL, NULL, N'header', 60, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'项目开发目标') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'项目开发目标', N'项目开发目标', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'项目输出') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'项目输出', N'项目输出', N'文本', NULL, NULL, NULL, NULL, N'header', 80, 180, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'开发周期要求') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'开发周期要求', N'开发周期要求', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'其它要求') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'其它要求', N'其它要求', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'申请立项人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'申请立项人', N'申请立项人', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'申请立项日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'申请立项日期', N'申请立项日期', N'日期', NULL, NULL, NULL, NULL, N'header', 120, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'文件管理人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'文件管理人', N'文件管理人', N'文本', NULL, NULL, NULL, NULL, N'header', 130, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'密级') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'密级', N'密级', N'下拉框', N'SELECT v FROM (VALUES (N''保密''),(N''内部''),(N''公开'')) AS t(v)', NULL, NULL, NULL, N'header', 140, 80, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'文件使用范围') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'文件使用范围', N'文件使用范围', N'下拉框', N'SELECT v FROM (VALUES (N''公司内''),(N''客户项目组''),(N''双方项目组'')) AS t(v)', NULL, NULL, NULL, N'header', 150, 100, 1, 0, 0, 1);
-- 文档编号(YJ-XS002):文书表头右上角可编辑;hidden=1 不出现在通用表单,仅供文书特例取键
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='RD_APPROVAL' AND col_name=N'文档编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('RD_APPROVAL', N'文档编号', N'文档编号', N'文本', NULL, NULL, NULL, NULL, N'header', 155, 120, 1, 0, 1, 1);
GO
-- en 译名(其它语言由实时机翻自动补齐)
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'立项申请' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'立项申请', 'en', N'Project Initiation Request', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'立项背景' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'立项背景', 'en', N'Initiation Background', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'机型及应用位置' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'机型及应用位置', 'en', N'Model & Application Position', 'manual');
-- 显示键=字段 label(含斜杠),col_name 去斜杠版译名无展示作用 → 清理旧键改用 label 键
DELETE FROM yj_translation WHERE scope='field' AND ref_key=N'滤芯炭棒规格或结构' AND locale='en';
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'滤芯/炭棒规格或结构' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'滤芯/炭棒规格或结构', 'en', N'Filter/Block Spec or Structure', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目开发目标' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目开发目标', 'en', N'Development Objectives', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'项目输出' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'项目输出', 'en', N'Project Deliverables', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'开发周期要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'开发周期要求', 'en', N'Development Cycle Requirement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'其它要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'其它要求', 'en', N'Other Requirements', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'文件管理人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'文件管理人', 'en', N'Document Manager', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'密级' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'密级', 'en', N'Confidentiality', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'文件使用范围' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'文件使用范围', 'en', N'Usage Scope', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'申请立项人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'申请立项人', 'en', N'Applicant', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'申请立项日期' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'申请立项日期', 'en', N'Application Date', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'客户名' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'客户名', 'en', N'Customer', 'manual');
