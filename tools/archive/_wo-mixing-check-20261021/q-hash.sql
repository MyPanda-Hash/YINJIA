SET NOCOUNT ON;
SELECT script_name, content_hash, applied_at FROM dbo.yj_schema_log
 WHERE script_name = N'migrate-wo-mixing-list-20261022.sql';
