SET NOCOUNT ON;
PRINT N'=== yj_schema_log 最近执行 25 条(按 applied_at) ===';
SELECT TOP 25 script_name, CONVERT(varchar(19), applied_at, 120) AS 执行时间
FROM dbo.yj_schema_log ORDER BY applied_at DESC;
GO
PRINT N'=== 迁移链里含 bs_wh 的脚本 ===';
SELECT script_name, CONVERT(varchar(19), applied_at, 120) AS 执行时间
FROM dbo.yj_schema_log WHERE script_name LIKE N'%wh%' OR script_name LIKE N'%golive%' OR script_name LIKE N'%cleanup%'
ORDER BY applied_at DESC;
GO