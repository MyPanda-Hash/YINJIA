-- migrate-qc-op.sql — ①销售出库单明细补批号(成品三键出库记账) ②工序质检单(品质层 #10)
SET NOCOUNT ON;

-- ① bl_sale_out 批号
BEGIN TRY
  IF COL_LENGTH('bl_sale_out', '批号') IS NULL ALTER TABLE bl_sale_out ADD [批号] nvarchar(30) NULL;
END TRY
BEGIN CATCH
  PRINT 'bl_sale_out 加列跳过(无 DDL 权限)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('SALE_OUT', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 55, 120, 1, 0, 0, 1);
GO

-- ② 工序质检单(qc_op / qc_op_detail,前缀 GJ):流程图 混料/成型/组装质检数据 的统一载体
IF OBJECT_ID('qc_op') IS NULL CREATE TABLE qc_op (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [工单号] nvarchar(60) NULL,
  [工序] nvarchar(50) NULL,
  [检验员] nvarchar(50) NULL,
  [检验日期] nvarchar(20) NULL,
  [总结论] nvarchar(20) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
IF OBJECT_ID('qc_op_detail') IS NULL CREATE TABLE qc_op_detail (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [检验项目] nvarchar(200) NULL,
  [标准要求] nvarchar(200) NULL,
  [检验结果] nvarchar(20) NULL,
  [实测数值] decimal(18,4) NULL,
  [备注] nvarchar(200) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_OP') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_OP', N'工序质检单', N'生产管理', 'doc', 'qc_op_detail', 'qc_op', N'单据编号', N'id', N'单据编号', N'GJ', N'单据日期', 20, 'items', N'生产制造');
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'工单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'工单号', N'工单号', N'参照', NULL, N'WO_ORDER', N'单据编号', N'单据编号', N'query,header', 30, 150, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'工序') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'工序', N'工序', N'下拉框', N'SELECT 工序名称 FROM bs_op WHERE ISNULL([状态],N''启用'')=N''启用'' AND ISNULL(是否停用,0)=0 ORDER BY id', NULL, NULL, NULL, N'query,header', 40, 110, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'检验员') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'检验员', N'检验员', N'文本', NULL, NULL, NULL, NULL, N'query,header', 50, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'检验日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'检验日期', N'检验日期', N'日期', NULL, NULL, NULL, NULL, N'header', 60, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'总结论') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'总结论', N'总结论', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格''),(N''让步接收'')) AS t(v)', NULL, NULL, NULL, N'query,header', 70, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header,detail', 80, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 90, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 140, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'检验项目') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'检验项目', N'检验项目', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 200, 200, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'标准要求') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'标准要求', N'标准要求', N'文本', NULL, NULL, NULL, NULL, N'detail', 210, 200, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'检验结果') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'检验结果', N'检验结果', N'下拉框', N'SELECT v FROM (VALUES (N''合格''),(N''不合格'')) AS t(v)', NULL, NULL, NULL, N'query,detail', 220, 90, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_OP' AND col_name=N'实测数值') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_OP', N'实测数值', N'实测数值', N'小数', NULL, NULL, NULL, NULL, N'detail', 230, 100, 1, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'工序质检单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'工序质检单', 'en', N'In-Process Inspection', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验项目' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验项目', 'en', N'Inspection Item', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'标准要求' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'标准要求', 'en', N'Standard Requirement', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'检验结果' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'检验结果', 'en', N'Result', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'实测数值' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'实测数值', 'en', N'Measured Value', 'manual');
GO
PRINT N'migrate-qc-op 完成';
GO
