SET NOCOUNT ON;
SELECT TOP 45 script_name, CONVERT(varchar(19), applied_at, 120) AS applied_at
FROM yj_schema_log ORDER BY applied_at DESC;
