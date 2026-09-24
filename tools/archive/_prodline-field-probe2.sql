SET NOCOUNT ON;
PRINT '--- yj_field 生产域计数 ---';
SELECT panel_code, place, COUNT(*) AS n FROM yj_field WHERE panel_code IN ('PROD_LINE','OP_TIME','MANU_ORDER','MANU_SCHEDULE','PROD_ABN','LINE_LOAD','WO_REPORT') GROUP BY panel_code, place ORDER BY panel_code;
PRINT '--- yj_field 总行数 ---';
SELECT COUNT(*) AS total FROM yj_field;
PRINT '--- yj_panel 生产域 ---';
SELECT panel_code, panel_name FROM yj_panel WHERE panel_code IN ('PROD_LINE','OP_TIME','MANU_ORDER','MANU_SCHEDULE','PROD_ABN','LINE_LOAD','WO_REPORT');
