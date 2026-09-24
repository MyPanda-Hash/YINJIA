SET NOCOUNT ON;
SELECT panel_code, place, COUNT(*) AS n FROM yj_field WHERE panel_code IN ('PROD_LINE','OP_TIME','LINE_LOAD','MANU_SCHEDULE','PROD_ABN') GROUP BY panel_code, place ORDER BY panel_code, place;
SELECT name FROM sys.objects WHERE name IN ('gxgs','bs_line_capacity','bs_prod_line','bd_prod_abn','v_line_load','v_manu_schedule') ORDER BY name;
