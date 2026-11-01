SET NOCOUNT ON;
SELECT script_name, executed_at FROM yj_schema_log
WHERE script_name LIKE '%20261029%' OR script_name LIKE '%20261028%';
