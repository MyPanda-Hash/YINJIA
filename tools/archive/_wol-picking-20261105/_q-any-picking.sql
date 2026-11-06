SET NOCOUNT ON;
SELECT DB_NAME() AS db, panel_code, COUNT(*) AS rows_with_picking
  FROM yj_role_panel WHERE ','+ISNULL(perms,'')+',' LIKE '%,picking,%'
 GROUP BY panel_code;
