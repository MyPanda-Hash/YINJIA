SET NOCOUNT ON;
PRINT '--- 5 面板字段数 ---';
SELECT panel_code, place, COUNT(*) AS n FROM yj_field WHERE panel_code IN ('PROD_LINE','OP_TIME','LINE_LOAD','MANU_SCHEDULE','PROD_ABN') GROUP BY panel_code, place ORDER BY panel_code, place;
PRINT '--- 关键表 ---';
SELECT name FROM sys.objects WHERE name IN ('gxgs','bs_line_capacity','bs_prod_line','bd_prod_abn') ORDER BY name;
PRINT '--- PROD_LINE 停用字段类型 ---';
SELECT panel_code, col_name, label, data_type, place, hidden, visible FROM yj_field WHERE panel_code='PROD_LINE' ORDER BY seq;
