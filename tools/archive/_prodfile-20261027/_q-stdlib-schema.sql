SET NOCOUNT ON;
SELECT name FROM sys.tables WHERE name LIKE 'yj_std%' OR name LIKE '%std_lib%';
SELECT name FROM sys.columns WHERE object_id=OBJECT_ID('yj_std_lib') ORDER BY column_id;
