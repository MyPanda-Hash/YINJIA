SET NOCOUNT ON;
SELECT t.name+'|'+c.name+'|'+CAST(dc.definition AS nvarchar(200)) AS r
FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE t.name IN ('rd_approval','rd_prod_info_head','rd_sample_ext_head','rd_sample_nondev_head') AND c.is_nullable=0
ORDER BY t.name, c.column_id;
GO
SELECT t.name+'|'+c.name AS r FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id
WHERE t.name IN ('rd_approval_detail','rd_prod_info_detail','rd_sample_ext_detail','rd_sample_nondev_detail') AND c.is_nullable=0;
GO
