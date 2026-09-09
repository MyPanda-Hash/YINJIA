-- migrate-purchase-in-inv-code.sql — 采购入库单明细补存货编码列(库存记账必需+品检链映射落点)
SET NOCOUNT ON;
BEGIN TRY
  IF COL_LENGTH('bl_purchase_in', '存货编码') IS NULL ALTER TABLE bl_purchase_in ADD [存货编码] nvarchar(100) NULL;
END TRY
BEGIN CATCH
  PRINT 'bl_purchase_in 加列跳过(无 DDL 权限)';
END CATCH
GO
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'存货编码') INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible) VALUES ('PURCHASE_IN', N'存货编码', N'存货编码', N'参照', NULL, N'INV', N'存货编码', N'存货编码', N'query,detail', 15, 120, 1, 1, 0, 1);
GO
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope='field' AND ref_key=N'存货编码' AND locale='en') INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'存货编码', 'en', N'Inventory Code', 'manual');
GO
PRINT N'migrate-purchase-in-inv-code 完成';
GO
