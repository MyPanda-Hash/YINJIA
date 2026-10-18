SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, ISNULL(prefix,'') AS prefix, ISNULL(code_col,'') AS code_col, ISNULL(head_table,'') AS head_table
FROM yj_panel
ORDER BY category, panel_name;
