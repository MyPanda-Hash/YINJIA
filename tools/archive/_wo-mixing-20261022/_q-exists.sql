SET NOCOUNT ON;
SELECT DB_NAME() AS db_name;
SELECT 'table' AS kind, s.name + '.' + t.name AS obj, t.create_date, t.modify_date
FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.name LIKE '%mixing%' OR t.name LIKE '%mix%';
SELECT 'view' AS kind, s.name + '.' + v.name AS obj
FROM sys.views v JOIN sys.schemas s ON s.schema_id = v.schema_id
WHERE v.name LIKE '%mixing%' OR v.name LIKE '%mix%';
