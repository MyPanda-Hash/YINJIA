SET NOCOUNT ON;
SELECT DB_NAME() db, script_name, LEFT(content_hash,12) hash FROM dbo.yj_schema_log WHERE script_name LIKE N'%no-month-closed%';
GO
