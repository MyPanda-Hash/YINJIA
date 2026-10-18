SET NOCOUNT ON;
SELECT panel_code, page_size, date_col, pk_col, code_col, group_col, line_table
FROM yj_panel WHERE panel_code IN ('STOCK_STATUS','STOCK_DETAIL','STOCK_BALANCE','STOCK_PICK');
