SET NOCOUNT ON;
SELECT '=== roles per panel ===' AS s;
SELECT p.panel_code, COUNT(*) AS roles, MIN(p.perms) AS minp, MAX(p.perms) AS maxp
  FROM dbo.yj_role_panel p
 WHERE p.panel_code IN (N'MATERIAL_OUT', N'MATERIAL_OUT_DETAIL', N'MATERIAL_OUT_STATS', N'WO_REPORT_LIST', N'STOCK_PICK')
 GROUP BY p.panel_code;
SELECT '=== MATERIAL_OUT_DETAIL grants ===' AS s;
SELECT r.role_name, r.is_admin, p.perms, p.can_approve
  FROM dbo.yj_role_panel p LEFT JOIN dbo.yj_role r ON r.id = p.role_id
 WHERE p.panel_code = N'MATERIAL_OUT_DETAIL' ORDER BY r.id;
SELECT '=== query-capable fields of MATERIAL_OUT_DETAIL ===' AS s;
SELECT col_name, label, data_type, place, seq, width FROM dbo.yj_field
 WHERE panel_code = N'MATERIAL_OUT_DETAIL' ORDER BY seq, id;
