-- migrate-finish-disposal.sql — ①产成品入库明细补产品编码/批号(成品入库三键记账) ②不良品处理单(品质层#11 隔离仓/不良品仓流转)
SET NOCOUNT ON;

-- ① bl_finish_in 补列
BEGIN TRY
  IF COL_LENGTH('bl_finish_in', '产品编码') IS NULL ALTER TABLE bl_finish_in ADD [产品编码] nvarchar(100) NULL;
  IF COL_LENGTH('bl_finish_in', '批号') IS NULL ALTER TABLE bl_finish_in ADD [批号] nvarchar(30) NULL;
END TRY
BEGIN CATCH
  PRINT 'bl_finish_in 加列跳过(无 DDL 权限)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FINISH_IN' AND col_name=N'产品编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FINISH_IN', N'产品编码', N'产品编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 25, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='FINISH_IN' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('FINISH_IN', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 27, 120, 1, 1, 0, 1);
GO

-- ② 不良品处理单(单表式 doc,前缀 BL):审核 → kucun 移仓(隔离仓/不良品仓)或报废扣减,弃审对称冲回
IF OBJECT_ID('qc_disposal') IS NULL CREATE TABLE qc_disposal (
  id int IDENTITY(1,1) PRIMARY KEY,
  [单据编号] nvarchar(60) NOT NULL,
  [单据日期] nvarchar(20) NULL,
  [来源单号] nvarchar(60) NULL,
  [物料编码] nvarchar(100) NULL,
  [物料名称] nvarchar(200) NULL,
  [批号] nvarchar(30) NULL,
  [数量] decimal(18,4) NULL,
  [原仓库] nvarchar(100) NULL,
  [处置方式] nvarchar(20) NULL,
  [处置原因] nvarchar(500) NULL,
  [经手人] nvarchar(50) NULL,
  [备注] nvarchar(500) NULL,
  [单据状态] nvarchar(10) NOT NULL DEFAULT N'草稿',
  [审核人] nvarchar(50) NULL,
  [审核时间] nvarchar(30) NULL,
  asp_user1 nvarchar(50) NULL, asp_time1 datetime2 NULL, asp_user2 nvarchar(50) NULL, asp_time2 datetime2 NULL, asp_cancel char(1) NULL DEFAULT 'N'
);
GO
IF NOT EXISTS (SELECT 1 FROM yj_panel WHERE panel_code = 'QC_DISPOSAL') INSERT INTO yj_panel (panel_code, panel_name, category, mode, line_table, head_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group) VALUES ('QC_DISPOSAL', N'不良品处理单', N'生产管理', 'doc', 'qc_disposal', NULL, N'单据编号', N'id', N'单据编号', N'BL', N'单据日期', 20, 'items', N'生产制造');
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'单据编号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'单据编号', N'单据编号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 10, 140, 0, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'单据日期') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'单据日期', N'单据日期', N'日期', NULL, NULL, NULL, NULL, N'query,header', 20, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'来源单号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'来源单号', N'来源单号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 30, 140, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'物料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'物料编码', N'物料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,header', 40, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'物料名称') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'物料名称', N'物料名称', N'文本', NULL, NULL, NULL, NULL, N'header', 50, 160, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,header', 60, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'数量') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'数量', N'数量', N'小数', NULL, NULL, NULL, NULL, N'query,header', 70, 100, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'原仓库') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'原仓库', N'原仓库', N'参照', NULL, N'WH', N'仓库名称', N'仓库名称', N'header', 80, 110, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'处置方式') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'处置方式', N'处置方式', N'下拉框', N'SELECT v FROM (VALUES (N''转隔离仓''),(N''转不良品仓''),(N''报废'')) AS t(v)', NULL, NULL, NULL, N'query,header', 90, 110, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'处置原因') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'处置原因', N'处置原因', N'文本', NULL, NULL, NULL, NULL, N'header', 100, 240, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'经手人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'经手人', N'经手人', N'文本', NULL, NULL, NULL, NULL, N'header', 110, 100, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'备注') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'备注', N'备注', N'文本', NULL, NULL, NULL, NULL, N'header', 120, 220, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'单据状态') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'单据状态', N'单据状态', N'文本', NULL, NULL, NULL, NULL, N'query,header', 130, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'审核人') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'审核人', N'审核人', N'文本', NULL, NULL, NULL, NULL, N'header', 140, 90, 0, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='QC_DISPOSAL' AND col_name=N'审核时间') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('QC_DISPOSAL', N'审核时间', N'审核时间', N'文本', NULL, NULL, NULL, NULL, N'header', 150, 140, 0, 0, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='panel' AND ref_key=N'不良品处理单' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('panel', N'不良品处理单', 'en', N'Defect Disposal', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'来源单号' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'来源单号', 'en', N'Source No.', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'原仓库' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'原仓库', 'en', N'From Warehouse', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'处置原因' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'处置原因', 'en', N'Disposal Reason', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'转隔离仓' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'转隔离仓', 'en', N'To Quarantine', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'转不良品仓' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'转不良品仓', 'en', N'To Defect WH', 'manual');
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'报废' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'报废', 'en', N'Scrap', 'manual');
GO
PRINT N'migrate-finish-disposal 完成';
GO
