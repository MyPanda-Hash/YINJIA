SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
SELECT TOP 3 * FROM dbo.yj_schema_log ORDER BY 1 DESC;