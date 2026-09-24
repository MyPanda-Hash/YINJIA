SET NOCOUNT ON;
PRINT '--- PROD_LINE 面板 yj_field 行 ---';
SELECT place, COUNT(*) AS n, SUM(CASE WHEN hidden = 1 THEN 1 ELSE 0 END) AS hidden_n
FROM yj_field WHERE panel_code = 'PROD_LINE' GROUP BY place;
PRINT '--- PROD_LINE 明细字段(前 40) ---';
SELECT TOP 40 seq, place, col_name, label, hidden, visible FROM yj_field WHERE panel_code = 'PROD_LINE' AND place = 'detail' ORDER BY seq;
PRINT '--- 生产域相关面板 yj_field 计数 ---';
SELECT panel_code, place, COUNT(*) AS n FROM yj_field
WHERE panel_code IN ('PROD_LINE','OP_TIME','MANU_ORDER','MANU_SCHEDULE','PROD_ABN','LINE_LOAD')
GROUP BY panel_code, place ORDER BY panel_code, place;
PRINT '--- bs_prod_line 列 ---';
SELECT name FROM sys.columns WHERE object_id = OBJECT_ID('bs_prod_line') ORDER BY column_id;
