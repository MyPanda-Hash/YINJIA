SET NOCOUNT ON;
SELECT DB_NAME() AS db, COUNT(*) AS total_rows,
       SUM(CASE WHEN ','+ISNULL(perms,'')+',' LIKE '%,picking,%' THEN 1 ELSE 0 END) AS picking_rows
  FROM yj_role_panel WHERE panel_code = N'WORK_ORDER_LIST';
SELECT id, role_id, panel_code, perms FROM yj_role_panel
 WHERE panel_code = N'WORK_ORDER_LIST' AND ','+ISNULL(perms,'')+',' LIKE '%,picking,%';
