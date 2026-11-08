SET NOCOUNT ON;
PRINT '=== panel ===';
SELECT panel_code, panel_name, panel_name_en FROM dbo.yj_panel WHERE panel_code = N'QC_PROC_INSP';
PRINT '=== translations new keys ===';
SELECT scope, ref_key, locale, text FROM dbo.yj_translation WHERE (scope=N'panel' AND ref_key=N'出货检验单功能') OR (scope=N'report' AND ref_key=N'出货检验记录表') OR ref_key=N'制程检验单' OR ref_key=N'制程检验记录表';
PRINT '=== report template ===';
SELECT template_code, panel_code, name, LEN(jrxml_text) AS xml_len, update_at FROM dbo.yj_report_template WHERE template_code=N'qc_proc_insp';
PRINT '=== schema log ===';
SELECT script_name, applied_at FROM dbo.yj_schema_log WHERE script_name LIKE N'%20261109%' ORDER BY script_name;
PRINT '=== title in template text ===';
SELECT CASE WHEN jrxml_text LIKE N'%出货检验记录表%' THEN 1 ELSE 0 END AS has_new,
       CASE WHEN jrxml_text LIKE N'%制程检验记录表%' THEN 1 ELSE 0 END AS has_old
FROM dbo.yj_report_template WHERE template_code=N'qc_proc_insp';
PRINT '=== menu overrides ===';
SELECT COUNT(*) AS menu_overrides FROM dbo.yj_menu_node;
