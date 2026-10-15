SET NOCOUNT ON;
SELECT DB_NAME() AS db,
       (SELECT COUNT(*) FROM yj_panel) AS panels,
       (SELECT COUNT(*) FROM yj_field) AS fields,
       (SELECT COUNT(*) FROM yj_role_panel) AS role_panels,
       (SELECT COUNT(*) FROM yj_translation) AS translations,
       (SELECT COUNT(*) FROM yj_schema_log) AS log_rows,
       (SELECT CONVERT(varchar(19), MAX(applied_at), 120) FROM yj_schema_log) AS last_applied;
