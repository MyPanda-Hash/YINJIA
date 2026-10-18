SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, prefix, code_col, line_table, head_table
FROM yj_panel
WHERE mode = 'doc'
ORDER BY prefix, panel_code;
