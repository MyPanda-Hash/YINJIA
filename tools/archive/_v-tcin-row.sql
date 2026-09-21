SET NOCOUNT ON;
PRINT '--- 列顺序 ---';
SELECT ROW_NUMBER() OVER (ORDER BY column_id) AS ord, name FROM sys.columns WHERE object_id=OBJECT_ID('qc_tc_in') AND name NOT LIKE 'asp[_]%';
GO
PRINT '--- id=3 整行(按上列顺序) ---';
SELECT * FROM qc_tc_in WHERE id=3;
GO
