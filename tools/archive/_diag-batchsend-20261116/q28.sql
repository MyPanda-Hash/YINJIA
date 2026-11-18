SET NOCOUNT ON;
SELECT TOP 8 script_name, content_hash, applied_at FROM yj_schema_log WHERE content_hash LIKE N'MANUAL%' ORDER BY applied_at DESC;
