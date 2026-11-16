SELECT DB_NAME() AS db, N'panels' AS k, COUNT(*) AS n FROM yj_panel
UNION ALL SELECT DB_NAME(), N'views', COUNT(*) FROM sys.views WHERE is_ms_shipped = 0
UNION ALL SELECT DB_NAME(), N'schema_log', COUNT(*) FROM yj_schema_log
UNION ALL SELECT DB_NAME(), N'role_panel', COUNT(*) FROM yj_role_panel
UNION ALL SELECT DB_NAME(), N'users', COUNT(*) FROM yj_user
UNION ALL SELECT DB_NAME(), N'panels_without_grants',
    (SELECT COUNT(*) FROM yj_panel p WHERE NOT EXISTS (SELECT 1 FROM yj_role_panel rp WHERE rp.panel_code = p.panel_code));
