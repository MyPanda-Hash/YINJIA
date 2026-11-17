SET NOCOUNT ON;
SELECT script_name, applied_at FROM yj_schema_log
WHERE script_name IN (N'migrate-wo-bom-20261113.sql', N'migrate-wo-draft-20261113.sql');
GO
SELECT COUNT(*) AS 已登记脚本数, MAX(applied_at) AS 最近执行 FROM yj_schema_log;
