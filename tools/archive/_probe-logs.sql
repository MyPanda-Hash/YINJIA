SET NOCOUNT ON;
SELECT TOP 8 script_name, applied_at FROM yj_schema_log ORDER BY applied_at DESC;
GO
SELECT TOP 10 * FROM yj_archive_change_log ORDER BY id DESC;
GO
