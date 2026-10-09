SET NOCOUNT ON;
PRINT '=== yj_schema_log 里的 converge 记录 ===';
SELECT script_name, content_hash, applied_at FROM yj_schema_log
WHERE script_name LIKE '%converge%' ORDER BY applied_at DESC;
GO
