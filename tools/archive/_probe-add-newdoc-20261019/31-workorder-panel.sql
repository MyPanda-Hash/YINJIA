SET NOCOUNT ON;
SELECT panel_code, panel_name, mode, head_table, line_table, group_col, prefix FROM yj_panel WHERE panel_name LIKE '%工单%' OR panel_code LIKE '%ORDER%';
SELECT COUNT(*) AS plang_rows FROM plang;
SELECT COUNT(*) AS bd_manu_order_rows FROM bd_manu_order;
