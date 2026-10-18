SET NOCOUNT ON;
SELECT version_key, LEFT(ISNULL([status],''),20) 状态, LEFT(ISNULL(applied_at,''),25) 时间 FROM yj_schema_log WHERE version_key LIKE '%module-group%' OR version_key LIKE '%stock-detail%' OR version_key LIKE '%dm-fields%' ORDER BY version_key;
PRINT '--- yj_schema_log 列 ---';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
