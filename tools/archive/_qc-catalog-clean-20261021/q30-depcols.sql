SET NOCOUNT ON;
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols
FROM sys.tables t WHERE t.name IN ('yj_doc_batch','yj_attachment','yj_doc_annotation');
