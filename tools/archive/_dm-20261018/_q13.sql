SET NOCOUNT ON;
SELECT c.name, t.name 类型, c.is_nullable, c.max_length FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('dbo.erp_imp_row') ORDER BY c.column_id;
PRINT '--- log 现有行 ---';
SELECT TOP 3 批次号, 导入类型, 总行数, 状态 FROM erp_imp_log WHERE 批次号 LIKE 'IMP-%';
SELECT COUNT(*) FROM erp_imp_row;
