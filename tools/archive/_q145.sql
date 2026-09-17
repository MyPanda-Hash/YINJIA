SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_field') ORDER BY c.column_id;
