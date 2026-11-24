SET NOCOUNT ON;
SELECT t.name+N'.'+c.name+N' NOTNULL def='+ISNULL(CAST(dc.definition AS nvarchar(200)),N'(none)') AS r
FROM sys.columns c JOIN sys.objects t ON t.object_id=c.object_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id=c.object_id AND dc.parent_column_id=c.column_id
WHERE t.name IN ('rd_approval','rd_prod_info_head','rd_sample_ext_head','rd_sample_nondev_head') AND c.is_nullable=0 AND c.is_identity=0
ORDER BY t.name, c.column_id;
GO
SELECT t.name+N' idx='+i.name+N' unique='+CAST(i.is_unique AS nvarchar(2))+N' cols='+c.name AS r
FROM sys.indexes i JOIN sys.objects t ON t.object_id=i.object_id
JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE t.name IN ('rd_approval','rd_prod_info_head','rd_sample_ext_head','rd_sample_nondev_head','rd_approval_detail','rd_prod_info_detail','rd_sample_ext_detail','rd_sample_nondev_detail')
ORDER BY t.name, i.name, ic.key_ordinal;
GO
