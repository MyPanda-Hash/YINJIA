SET NOCOUNT ON;
PRINT '--- 有面板但零字段的面板(yj_field 无行) ---';
SELECT p.panel_code, p.panel_name
FROM yj_panel p
LEFT JOIN yj_field f ON f.panel_code = p.panel_code
GROUP BY p.panel_code, p.panel_name
HAVING COUNT(f.id) = 0
ORDER BY p.panel_code;
PRINT '--- 生产域面板字段分布 ---';
SELECT panel_code, place, COUNT(*) AS n FROM yj_field
WHERE panel_code IN ('PROD_LINE','OP_TIME','LINE_LOAD','MANU_SCHEDULE','PROD_ABN','MANU_ORDER','WO_REPORT','WO_ORDER','WO_SCHEDULE','DISPATCH','MATERIAL_OUT','FINISH_IN')
GROUP BY panel_code, place ORDER BY panel_code, place;
