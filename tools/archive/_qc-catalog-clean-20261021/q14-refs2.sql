SET NOCOUNT ON;
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols
FROM sys.tables t WHERE t.name IN ('yj_form_approval','form_flow_link','yj_attachment','yj_doc_annotation','qc_tc_in','qc_return');
GO
SELECT source_panel_code,source_form_no,target_panel_code,target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP_REC' OR target_panel_code='QC_INSP_REC';
GO
SELECT lb, ny, MAX(dh) dh, COUNT(*) n FROM s_allno WHERE lb='JYSJ' GROUP BY lb,ny ORDER BY ny DESC;
