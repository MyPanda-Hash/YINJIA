SET NOCOUNT ON;
SELECT 'tables' AS k, COUNT(*) AS n FROM sys.tables
UNION ALL SELECT 'views', COUNT(*) FROM sys.views
UNION ALL SELECT 'tables_no_msdesc', COUNT(*) FROM sys.tables t WHERE NOT EXISTS (SELECT 1 FROM sys.extended_properties ep WHERE ep.major_id=t.object_id AND ep.minor_id=0 AND ep.name='MS_Description')
UNION ALL SELECT 'VIEW_* 遗留', COUNT(*) FROM sys.tables WHERE name LIKE 'VIEW[_]%'
UNION ALL SELECT 'RENAME_/bak/tmp', COUNT(*) FROM sys.tables WHERE name LIKE 'RENAME[_]%' OR name LIKE '%[_]bak[_]%' OR name LIKE 'tmp[_]%' OR name IN ('t1','t2');
GO
