SELECT applied_at, script_name FROM dbo.yj_schema_log
 WHERE script_name LIKE '%insp-gate%' OR script_name LIKE '%20261018%' OR script_name LIKE '%20261017%'
 ORDER BY applied_at DESC;
SELECT panel_code, ISNULL(config,N'') AS config
 FROM dbo.yj_panel WHERE panel_code IN ('QC_FIRST_INSP','QC_PROC_INSP','QC_ASM_INSP');
