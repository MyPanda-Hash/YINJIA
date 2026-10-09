SET NOCOUNT ON;
SELECT DB_NAME() AS 库, script_name AS 脚本, applied_at AS 执行时间 FROM yj_schema_log WHERE script_name LIKE N'%wo-process-line-drop%';
GO