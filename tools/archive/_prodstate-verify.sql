SET NOCOUNT ON;
PRINT '--- 视图 ---';
SELECT name FROM sys.objects WHERE name IN ('v_manu_schedule','v_line_load','v_manu_order_detail','v_wo_kit') ORDER BY name;
PRINT '--- 5 面板字段数 ---';
SELECT panel_code, place, COUNT(*) AS n FROM yj_field WHERE panel_code IN ('PROD_LINE','OP_TIME','LINE_LOAD','MANU_SCHEDULE','PROD_ABN') GROUP BY panel_code, place ORDER BY panel_code, place;
PRINT '--- v_manu_schedule 关键列 ---';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='v_manu_schedule' AND COLUMN_NAME IN (N'已报工',N'开产量',N'生产状态',N'未完成数量',N'排产数量');
PRINT '--- 表 ---';
SELECT name FROM sys.tables WHERE name IN ('bs_line_capacity','bs_prod_line','bs_line_open','bd_prod_abn','wo_report') ORDER BY name;
