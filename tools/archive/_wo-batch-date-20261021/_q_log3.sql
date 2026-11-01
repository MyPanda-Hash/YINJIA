SET NOCOUNT ON;
SELECT DB_NAME() AS db, script_name, LEFT(content_hash,12) AS hash, CONVERT(varchar(19),applied_at,120) AS at
FROM dbo.yj_schema_log WHERE script_name LIKE N'%batch-date-closed%';
GO
