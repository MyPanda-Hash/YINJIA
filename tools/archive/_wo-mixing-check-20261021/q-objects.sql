SET NOCOUNT ON;
SELECT DB_NAME() AS db_name, s.name AS sch, o.name, o.type_desc, o.create_date, o.modify_date
  FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
 WHERE o.name LIKE N'%mixing%' OR o.name LIKE N'%mix%'
 ORDER BY o.type_desc, o.name;
