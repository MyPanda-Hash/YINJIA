SET NOCOUNT ON;
SELECT COUNT(*) AS failtest_log_rows FROM yj_schema_log WHERE script_name = '_fail-severity16.sql';
GO
SELECT script_name, content_hash FROM yj_schema_log
 WHERE script_name IN ('migrate-asm-bom-data-20261030.sql','migrate-asm-bom-data-full-20261105.sql','_fail-severity16.sql')
 ORDER BY script_name;
GO
