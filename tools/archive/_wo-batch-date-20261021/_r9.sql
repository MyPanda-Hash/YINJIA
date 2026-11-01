SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE t.name IN ('yj_doc_status','yj_form_approval','yj_doc_annotation','yj_attachment','yj_usage_log') ORDER BY t.name,c.column_id;
GO
