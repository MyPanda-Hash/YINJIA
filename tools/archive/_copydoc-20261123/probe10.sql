SET NOCOUNT ON;
SELECT t.name+'|'+c.name+'|'+ty.name AS r
FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('rd_sample_nondev_head')
ORDER BY c.column_id;
GO
SELECT name FROM sys.indexes WHERE object_id=OBJECT_ID('rd_prod_info_head') AND is_unique=1;
GO
SELECT i.name, c.name AS col FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id WHERE i.object_id=OBJECT_ID('rd_prod_info_head');
GO
