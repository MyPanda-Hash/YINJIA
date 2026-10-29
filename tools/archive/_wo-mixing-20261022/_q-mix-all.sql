SET NOCOUNT ON;
USE HSDZ_MES_TEST;
SELECT 'TEST' db, name, type_desc FROM sys.objects WHERE name LIKE '%mixing%' OR name LIKE '%mix%';
USE HSDZ_MES_CHAIN;
SELECT 'CHAIN' db, name, type_desc FROM sys.objects WHERE name LIKE '%mixing%' OR name LIKE '%mix%';
USE HSDZ_MES_RESTORE;
SELECT 'RESTORE' db, name, type_desc FROM sys.objects WHERE name LIKE '%mixing%' OR name LIKE '%mix%';
USE HSDZ_MES_inspect;
SELECT 'INSPECT' db, name, type_desc FROM sys.objects WHERE name LIKE '%mixing%' OR name LIKE '%mix%';
