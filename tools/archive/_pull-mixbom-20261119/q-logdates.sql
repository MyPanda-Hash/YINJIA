SELECT TOP 12 CONVERT(varchar(10), applied_at, 120) AS d, COUNT(*) AS n
FROM yj_schema_log GROUP BY CONVERT(varchar(10), applied_at, 120) ORDER BY d DESC;
SELECT COUNT(*) AS wo_line_field_logged FROM yj_schema_log WHERE script_name LIKE '%qc-proc-insp-wo-line%';
SELECT COUNT(*) AS total_scripts_in_log FROM yj_schema_log;