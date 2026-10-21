SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col, ty.name AS typ, c.max_length, c.is_nullable
FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN ('qc_catalog','qc_catalog_detail','qc_insp','qc_insp_detail','qc_insp_rec','qc_insp_rec_detail')
ORDER BY t.name, c.column_id;
