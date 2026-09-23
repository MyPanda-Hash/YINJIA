-- _q-change3.sql —— RD_CHANGE 字段与面板行
SET NOCOUNT ON;
SELECT f.label, f.col_name, f.data_type, f.place, f.seq, f.required, f.editable,
       CASE WHEN f.ref_panel IS NULL THEN '' ELSE f.ref_panel END AS ref_panel,
       CASE WHEN f.dict_sql IS NULL THEN '' ELSE f.dict_sql END AS dict_sql,
       CASE WHEN f.ref_filter IS NULL THEN '' ELSE f.ref_filter END AS ref_filter
  FROM yj_field f WHERE f.panel_code = 'RD_CHANGE' ORDER BY f.place, f.seq;
GO
SELECT panel_code, panel_name, category, head_table, line_table, group_col, prefix, place, is_doc FROM yj_panel WHERE panel_code = 'RD_CHANGE';
GO
SELECT TOP 5 * FROM yj_role_panel WHERE panel_code = 'RD_CHANGE';
GO
