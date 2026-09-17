SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, line_table FROM yj_panel WHERE panel_code IN ('SALE_OUT_STATS','PURCHASE_IN_DETAIL','STOCK_BALANCE','STOCK_STATUS','WH_RECORD');
SELECT panel_code, col_name, place FROM yj_field WHERE panel_code='SALE_OUT_STATS' AND place LIKE '%query%' ORDER BY seq;
