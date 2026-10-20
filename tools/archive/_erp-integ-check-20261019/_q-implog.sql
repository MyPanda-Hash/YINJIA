SET NOCOUNT ON;
PRINT N'-- erp_imp_log 列';
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.erp_imp_log') ORDER BY c.column_id;
PRINT N'-- 最近 20 条';
SELECT TOP 20 * FROM erp_imp_log ORDER BY id DESC;
