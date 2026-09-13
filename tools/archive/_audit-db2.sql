SET NOCOUNT ON;
SELECT 'DETAIL' AS kind, f.panel_code, p.line_table AS tbl, f.label, f.col_name FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.line_table IS NOT NULL AND OBJECT_ID(p.line_table, 'U') IS NOT NULL
  AND f.col_name IS NOT NULL AND f.place LIKE '%detail%'
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(p.line_table) AND c.name = f.col_name);
SELECT 'HEADER' AS kind, f.panel_code, p.head_table AS tbl, f.label, f.col_name FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.head_table IS NOT NULL AND OBJECT_ID(p.head_table, 'U') IS NOT NULL
  AND f.col_name IS NOT NULL AND f.place LIKE '%header%'
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(p.head_table) AND c.name = f.col_name);