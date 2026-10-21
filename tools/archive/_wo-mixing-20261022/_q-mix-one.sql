SET NOCOUNT ON;
SELECT DB_NAME() AS db, name, type_desc FROM sys.objects WHERE name LIKE '%mixing%' OR name LIKE '%mix%' ORDER BY name;
