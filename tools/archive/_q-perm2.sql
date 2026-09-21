SET NOCOUNT ON;
SELECT 'TOTAL_ROWS' AS k, COUNT(*) AS v FROM yj_role_panel;
GO
SELECT 'ROLES' AS k, COUNT(*) AS v FROM yj_role;
GO
SELECT panel_code, COUNT(*) AS n FROM yj_role_panel GROUP BY panel_code;
GO
SELECT TOP 10 id, role_id, panel_code, can_approve, perms FROM yj_role_panel ORDER BY panel_code;
GO
