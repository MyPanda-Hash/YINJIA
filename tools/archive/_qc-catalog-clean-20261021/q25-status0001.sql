SET NOCOUNT ON;
SELECT * FROM yj_doc_status WHERE panel_code='QC_INSP_REC' AND doc_no='JYSJ-2026-10-0001';
GO
SELECT * FROM yj_form_approval WHERE panel_code='QC_INSP_REC' AND form_no='JYSJ-2026-10-0001';
GO
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols FROM sys.tables t WHERE t.name='yj_doc_status';
