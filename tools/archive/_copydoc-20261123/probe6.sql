SET NOCOUNT ON;
SELECT t.name+'|'+c.name+'|'+ty.name+'|'+CAST(c.max_length AS varchar(10))+'|isnull'+CAST(c.is_nullable AS varchar(2)) AS r
FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('rd_approval','rd_approval_detail','rd_prod_info_head','rd_prod_info_detail',
 'rd_sample_ext_head','rd_sample_ext_detail','rd_sample_nondev_head','rd_sample_nondev_detail')
ORDER BY t.name, c.column_id;
GO
