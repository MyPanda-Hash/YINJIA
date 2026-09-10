-- migrate-wo-report.sql — 报工单(生产过程层:五道工序进度累计入口)
-- 模型: wo_report 单表式 doc(一行一报);审核 → wo_progress.完成数量 累计,弃审对称冲回
-- 流程图依据: 所有报工都在PDA或手机端扫码完成(工单二维码);完成数=工单报工数求和
SET NOCOUNT ON;

IF OBJECT_ID('wo_report') IS NULL CREATE TABLE wo_report (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [工单号] nvarchar(60) NULL,
  [工序] nvarchar(50) NULL,
  [报工数量] decimal(18,4) NULL,
  [报工人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO

IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_REPORT') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WO_REPORT', N'工序报工单', N'生产管理', 'doc', 'wo_report', NULL, N'单据编号', N'id', N'单据编号', N'BG', N'单据日期', 20, 'items', N'生产制造');
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'WO_REPORT_LIST') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('WO_REPORT_LIST', N'报工记录', N'生产管理', 'flat', 'wo_report', NULL, NULL, N'id', NULL, NULL, NULL, 100, 'items', N'生产制造');
GO

IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'工单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'工单号', N'工单号', N'参照', NULL, N'WO_ORDER', N'单据编号', N'单据编号', N'query,header', 30, 150, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'工序') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'工序', N'工序', N'下拉框', N'SELECT 工序名称 FROM bs_op WHERE ISNULL([状态],N''启用'')=N''启用'' AND ISNULL(是否停用,0)=0 ORDER BY id', NULL, NULL, NULL, N'query,header', 40, 110, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'报工数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'报工数量', N'报工数量', N'小数', NULL, NULL, NULL, NULL, N'query,header', 50, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'报工人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'报工人', N'报工人', N'文本', NULL, NULL, NULL, NULL, N'query,header', 60, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 70, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 80, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 90, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 140, 0, 0, 0, 1);
-- 报工记录(平表)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 10, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'单据日期', N'单据日期', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 20, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'工单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'工单号', N'工单号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 30, 150, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'工序') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'工序', N'工序', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 40, 110, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'报工数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'报工数量', N'报工数量', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 50, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'报工人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'报工人', N'报工人', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 60, 100, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 70, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='WO_REPORT_LIST' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('WO_REPORT_LIST', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'detail', 80, 90, 0, 0, 0, 1);
GO

IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序报工单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'工序报工单', 'en', N'Operation Report', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'报工记录' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'报工记录', 'en', N'Work Reports', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'报工数量' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'报工数量', 'en', N'Reported Qty', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'报工人' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'报工人', 'en', N'Reporter', 'manual');
GO

PRINT N'migrate-wo-report 完成';
GO
