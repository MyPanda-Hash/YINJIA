SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_purchase_in') ORDER BY c.column_id;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') ORDER BY c.column_id;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_sale_out') ORDER BY c.column_id;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_sale_out') ORDER BY c.column_id;
