SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bl_purchase_in') AND (c.name='id' OR c.name LIKE N'%序号%' OR c.is_identity=1);
