SET NOCOUNT ON;
SELECT p.panel_code, p.panel_name, p.mode, p.line_table, p.head_table, p.group_col, p.date_col
  FROM yj_panel p WHERE p.panel_code IN (N'SALE_IN', N'SALE_OUT');
SELECT f.seq, f.label, f.col_name, f.place, f.visible, f.hidden, f.data_type
  FROM yj_field f WHERE f.panel_code = N'SALE_IN' ORDER BY f.place, f.seq, f.id;