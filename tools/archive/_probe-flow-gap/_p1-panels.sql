SET NOCOUNT ON;
PRINT '=== yj_panel columns ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID('yj_panel') ORDER BY c.column_id;
GO
PRINT '=== panel count by module_group ===';
SELECT module_group, COUNT(*) AS n FROM yj_panel GROUP BY module_group ORDER BY n DESC;
GO
