SET NOCOUNT ON;
SELECT script_name, CONVERT(varchar(19), applied_at, 120) AS applied_at, LEFT(content_hash, 12) AS hash12
FROM yj_schema_log WHERE script_name LIKE '%scm-qc-perms%';
SELECT COUNT(*) AS 台账总数 FROM yj_schema_log;
