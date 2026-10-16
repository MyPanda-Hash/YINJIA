SET NOCOUNT ON;
SELECT COUNT(*) AS rows_total FROM dbo.yj_report_template;
SELECT COUNT(*) AS rows_mine FROM dbo.yj_report_template WHERE template_code = N'qc_proc_insp';
SELECT id, template_code, panel_code, name, enabled, LEN(jrxml_text) AS xml_chars FROM dbo.yj_report_template;
