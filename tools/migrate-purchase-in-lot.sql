-- migrate-purchase-in-lot.sql — 采购入库单明细补批号列(品检分流链批号贯通:暂收→检验→入库)
SET NOCOUNT ON;
BEGIN TRY
  IF COL_LENGTH('bl_purchase_in', '批号') IS NULL ALTER TABLE bl_purchase_in ADD [批号] nvarchar(30) NULL;
END TRY
BEGIN CATCH
  PRINT 'bl_purchase_in 加列跳过(无 DDL 权限)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'批号') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'批号', N'批号', N'文本', NULL, NULL, NULL, NULL, N'detail', 225, 120, 1, 0, 0, 1);
GO
PRINT N'migrate-purchase-in-lot 完成';
GO
