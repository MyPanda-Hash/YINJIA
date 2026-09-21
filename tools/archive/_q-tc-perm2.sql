SET NOCOUNT ON;
PRINT '=== QC_* 面板权限行覆盖情况 ===';
SELECT p.panel_code, COUNT(r.id) AS perm_rows
FROM yj_panel p LEFT JOIN yj_role_panel r ON r.panel_code=p.panel_code
WHERE p.panel_code LIKE 'QC[_]%' GROUP BY p.panel_code ORDER BY p.panel_code;
GO
PRINT '=== 有权限行的 QC 面板样例(角色/perms) ===';
SELECT TOP 20 r.panel_code, r.role_id, r.perms FROM yj_role_panel r WHERE r.panel_code LIKE 'QC[_]%' ORDER BY r.panel_code;
GO
