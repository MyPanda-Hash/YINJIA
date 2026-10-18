SET NOCOUNT ON;
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.module_group, p.page_size FROM yj_panel p WHERE p.panel_code IN ('SO_ORDER','SALES_ORDER_DETAIL','SALES_ORDER_STATS','PU_ORDER','PURCHASE_IN_DETAIL','PURCHASE_IN_STATS') ORDER BY p.panel_code;
PRINT '--- SALES_ORDER_DETAIL 字段 ---';
SELECT col_name, label, data_type, place, seq, width, visible FROM yj_field WHERE panel_code='SALES_ORDER_DETAIL' ORDER BY seq;
PRINT '--- SALES_ORDER_STATS 字段 ---';
SELECT col_name, label, data_type, place, seq, width, visible FROM yj_field WHERE panel_code='SALES_ORDER_STATS' ORDER BY seq;
