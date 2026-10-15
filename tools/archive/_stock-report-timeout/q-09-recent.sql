SET NOCOUNT ON;
GO
SELECT script_name, applied_at FROM yj_schema_log WHERE applied_at >= '2026-10-14' ORDER BY applied_at;
GO
