SET NOCOUNT ON;
SELECT DB_NAME() db, content_hash FROM dbo.yj_schema_log WHERE script_name=N'migrate-plang-batch-date-closed-20261021.sql';
GO
