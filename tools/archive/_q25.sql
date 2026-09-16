SET NOCOUNT ON;
IF COL_LENGTH('dbo.bl_purchase_in', N'仓位名称') IS NULL AND EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓位名称' AND place='detail')
  ALTER TABLE dbo.bl_purchase_in ADD [仓位名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bl_sale_out', N'仓位名称') IS NULL AND EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓位名称' AND place='detail')
  ALTER TABLE dbo.bl_sale_out ADD [仓位名称] nvarchar(200) NULL;
IF COL_LENGTH('dbo.bl_purchase_in', N'仓位编码') IS NULL AND EXISTS(SELECT 1 FROM yj_field WHERE panel_code='PURCHASE_IN' AND col_name=N'仓位编码' AND place='detail')
  ALTER TABLE dbo.bl_purchase_in ADD [仓位编码] nvarchar(100) NULL;
IF COL_LENGTH('dbo.bl_sale_out', N'仓位编码') IS NULL AND EXISTS(SELECT 1 FROM yj_field WHERE panel_code='SALE_OUT' AND col_name=N'仓位编码' AND place='detail')
  ALTER TABLE dbo.bl_sale_out ADD [仓位编码] nvarchar(100) NULL;
SELECT 'bl_purchase_in' AS t, COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_purchase_in')
UNION ALL SELECT 'bl_sale_out', COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bl_sale_out');
