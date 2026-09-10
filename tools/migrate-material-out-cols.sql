-- migrate-material-out-cols.sql — 材料出库单明细补 材料编码/批号(扫码领料三键扣减:BOM 生成+人工扫码补批号)
SET NOCOUNT ON;
BEGIN TRY
  IF COL_LENGTH('bl_material_out', '材料编码') IS NULL ALTER TABLE bl_material_out ADD [材料编码] nvarchar(100) NULL;
  IF COL_LENGTH('bl_material_out', '批号') IS NULL ALTER TABLE bl_material_out ADD [批号] nvarchar(30) NULL;
END TRY
BEGIN CATCH
  PRINT 'bl_material_out 加列跳过(无 DDL 权限)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'材料编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'材料编码', N'材料编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 25, 120, 1, 1, 0, 1);
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='MATERIAL_OUT' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('MATERIAL_OUT', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'query,detail', 27, 120, 1, 1, 0, 1);
GO
PRINT N'migrate-material-out-cols 完成';
GO
