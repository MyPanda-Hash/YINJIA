SET NOCOUNT ON;
SELECT script_name, CONVERT(varchar(19), applied_at, 120) AS 执行时间 FROM yj_schema_log WHERE script_name LIKE '%module-group%' OR script_name LIKE '%stock-detail%' ORDER BY applied_at;
