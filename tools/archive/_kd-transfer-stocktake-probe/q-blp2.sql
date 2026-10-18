SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND (c.name LIKE N'%存货%' OR c.name LIKE N'%物料%' OR c.name LIKE N'%数量%') ORDER BY c.column_id;
