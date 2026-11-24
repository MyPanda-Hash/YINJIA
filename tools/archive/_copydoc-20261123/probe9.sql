SET NOCOUNT ON;
SELECT t.name+'|'+c.name+'|'+ty.name AS r
FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('rd_sample_ext_head','rd_sample_nondev_head','rd_sample_nondev_detail')
  AND c.name NOT LIKE '备用%'
ORDER BY t.name, c.column_id;
GO
