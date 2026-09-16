SET NOCOUNT ON;
SELECT COUNT(*) AS field_count FROM yj_field WHERE panel_code='STOCK_BALANCE';
SELECT panel_code, panel_name, mode, line_table, pk_col FROM yj_panel WHERE panel_code='STOCK_BALANCE';
