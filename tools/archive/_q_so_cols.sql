SET NOCOUNT ON;
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.bd_sale_out') ORDER BY column_id;
