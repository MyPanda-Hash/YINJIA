SET NOCOUNT ON;
PRINT '--- production plan panels (module_group) ---';
SELECT panel_code, panel_name, category, mode, module_group, head_table, line_table
FROM yj_panel WHERE module_group LIKE N'%生产%' ORDER BY module_group, panel_code;
PRINT '--- distinct data_type in use ---';
SELECT data_type, COUNT(*) AS n FROM yj_field GROUP BY data_type ORDER BY n DESC;
PRINT '--- fields with data_type like image ---';
SELECT panel_code, col_name, label, data_type, place, visible, seq
FROM yj_field WHERE data_type LIKE N'%图%' OR data_type LIKE N'%image%' OR data_type LIKE N'%file%'
ORDER BY panel_code, seq;
PRINT '--- tables mentioning flow/card/image/batch ---';
SELECT name FROM sys.tables WHERE name LIKE N'%flow%' OR name LIKE N'%card%' OR name LIKE N'%image%'
   OR name LIKE N'%img%' OR name LIKE N'%batch%' OR name LIKE N'%trace%' ORDER BY name;
PRINT '--- plang columns ---';
SELECT c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.plang') ORDER BY c.column_id;
