SET NOCOUNT ON;
SELECT script_name, applied_at FROM yj_schema_log
WHERE script_name LIKE '%stock%' OR script_name LIKE '%kucun%'
ORDER BY applied_at DESC;
