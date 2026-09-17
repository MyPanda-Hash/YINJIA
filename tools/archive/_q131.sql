SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.sl_recv') ORDER BY c.column_id;
