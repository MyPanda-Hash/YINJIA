SET NOCOUNT ON;
GO
SELECT script_name, applied_at FROM yj_schema_log
WHERE script_name LIKE '%batch%' ORDER BY script_name;
GO
