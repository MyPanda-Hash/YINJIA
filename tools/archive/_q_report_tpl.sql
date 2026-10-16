SET NOCOUNT ON;
PRINT '== yj_report_template 里 QC_PROC_INSP 的模板 ==';
SELECT id, template_code, panel_code, name, enabled, LEN(jrxml_text) AS xml_chars, update_by, update_at
FROM dbo.yj_report_template WHERE panel_code = N'QC_PROC_INSP' OR template_code = N'qc_proc_insp';
