SET NOCOUNT ON;
SELECT id, template_code, panel_code, name, enabled, LEN(jrxml_text) AS xml_chars,
       CONVERT(nvarchar(23), update_at, 121) AS upd
FROM dbo.yj_report_template WHERE template_code = N'qc_proc_insp';
SELECT CASE WHEN jrxml_text LIKE N'%检验人员%' THEN 1 ELSE 0 END AS has_inspector,
       CASE WHEN jrxml_text LIKE N'%产线常规功能性结果%' THEN 1 ELSE 0 END AS has_func,
       CASE WHEN jrxml_text LIKE N'%以下检验项目对应出货检验计划的检查频率%' THEN 1 ELSE 0 END AS old_layout;
