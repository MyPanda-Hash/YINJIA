SELECT c.name, t.name AS typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('yj_doc_status') ORDER BY c.column_id;
GO
SELECT TOP 8 doc_no, ISNULL(shr,N'') AS shr, ISNULL(archived,N'') AS archived, archived_at, ISNULL(pending,N'') AS pending, ISNULL(canceled,N'') AS canceled FROM yj_doc_status WHERE panel_code=N'QC_INSP_REC' ORDER BY id DESC;
GO
SELECT COUNT(*) AS n, SUM(CASE WHEN ISNULL(shr,N'')<>N'' THEN 1 ELSE 0 END) AS with_shr, SUM(CASE WHEN ISNULL(archived,N'')='Y' THEN 1 ELSE 0 END) AS with_arch FROM yj_doc_status WHERE panel_code=N'QC_INSP_REC';
