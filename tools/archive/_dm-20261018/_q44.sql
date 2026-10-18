SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.yj_schema_log') ORDER BY c.column_id;
PRINT '--- 相关登记 ---';
SELECT TOP 10 * FROM yj_schema_log WHERE 1=0;
