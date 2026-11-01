SET NOCOUNT ON;
SELECT DB_NAME() AS db, script, executed_at FROM dbo.yj_schema_log WHERE script LIKE N'%batch-date-closed%';
GO
