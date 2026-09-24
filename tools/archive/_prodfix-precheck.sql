SET NOCOUNT ON;
SELECT name FROM sys.objects WHERE name IN ('gxgs','bd_prod_abn','bs_prod_line','bs_line_capacity','bs_line_open','v_line_load','v_manu_schedule','v_manu_order_detail','v_wo_kit') ORDER BY name;
SELECT panel_code FROM yj_panel WHERE panel_code IN ('PROD_LINE','OP_TIME','LINE_LOAD','MANU_SCHEDULE','PROD_ABN') ORDER BY panel_code;
