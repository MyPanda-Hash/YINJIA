SET NOCOUNT ON;
SELECT OBJECT_NAME(c.object_id) tbl, c.name col FROM sys.columns c
WHERE c.name LIKE N'%检验数据记录%' OR c.name LIKE N'%检验单号%' ORDER BY tbl, col;
GO
SELECT doc_no, canceled, saved FROM yj_doc_status WHERE panel_code='QC_INSP_REC' ORDER BY doc_no;
GO
SELECT form_no, status FROM yj_form_approval WHERE panel_code='QC_INSP_REC' ORDER BY form_no;
GO
SELECT source_panel_code,source_form_no,target_panel_code,target_form_no FROM form_flow_link WHERE source_panel_code='QC_INSP_REC' OR target_panel_code='QC_INSP_REC';
GO
SELECT lb, ny, MAX(dh) dh, COUNT(*) n FROM s_allno WHERE lb='JYSJ' GROUP BY lb,ny ORDER BY ny DESC;
