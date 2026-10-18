SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND c.name LIKE N'%仓%' ORDER BY c.column_id;
