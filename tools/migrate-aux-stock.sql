-- migrate-aux-stock.sql — 四个辅助出入库面板补编码/批号列 + 接入台账
-- OTHER_IN(其他入库,inbound) OTHER_OUT(其他出库,outbound) OUTSOURCE_IN(委外入库,inbound) OUTSOURCE_ISSUE(委外发料,outbound)
SET NOCOUNT ON;
BEGIN TRY
  -- 其他入库:补 存货编码+批号
  IF COL_LENGTH('bl_other_in','存货编码') IS NULL ALTER TABLE bl_other_in ADD [存货编码] nvarchar(100) NULL;
  IF COL_LENGTH('bl_other_in','批号') IS NULL ALTER TABLE bl_other_in ADD [批号] nvarchar(30) NULL;
  -- 其他出库:补 存货编码+批号
  IF COL_LENGTH('bl_other_out','存货编码') IS NULL ALTER TABLE bl_other_out ADD [存货编码] nvarchar(100) NULL;
  IF COL_LENGTH('bl_other_out','批号') IS NULL ALTER TABLE bl_other_out ADD [批号] nvarchar(30) NULL;
  -- 委外入库:补 批号(产品编码可能已有)
  IF COL_LENGTH('bl_outsource_in','批号') IS NULL ALTER TABLE bl_outsource_in ADD [批号] nvarchar(30) NULL;
  -- 委外发料:补 批号(材料编码可能已有)
  IF COL_LENGTH('bl_outsource_issue','批号') IS NULL ALTER TABLE bl_outsource_issue ADD [批号] nvarchar(30) NULL;
END TRY
BEGIN CATCH
  PRINT '加列跳过(无 DDL 权限)';
END CATCH
GO
-- 字段注册(编码+批号,query/detail)
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND col_name=N'存货编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('OTHER_IN', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 15, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_IN' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('OTHER_IN', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 17, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND col_name=N'存货编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('OTHER_OUT', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 15, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OTHER_OUT' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('OTHER_OUT', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 17, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OUTSOURCE_IN' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('OUTSOURCE_IN', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 17, 120, 1, 0, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='OUTSOURCE_ISSUE' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('OUTSOURCE_ISSUE', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 17, 120, 1, 1, 0, 1);
GO
PRINT N'migrate-aux-stock 完成';
GO
