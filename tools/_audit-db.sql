SET NOCOUNT ON;
-- 1) line_table/head_table 指向的对象不存在
SELECT 'MISSING_TABLE' AS kind, p.panel_code, p.line_table AS tbl FROM yj_panel p
WHERE p.line_table IS NOT NULL AND OBJECT_ID(p.line_table) IS NULL
UNION ALL
SELECT 'MISSING_TABLE', p.panel_code, p.head_table FROM yj_panel p
WHERE p.head_table IS NOT NULL AND OBJECT_ID(p.head_table) IS NULL;
-- 2) 真实表(line_table 为 U 表)上字段引用的列不存在
SELECT 'MISSING_COL' AS kind, f.panel_code, p.line_table AS tbl, f.label, f.col_name FROM yj_field f
JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.line_table IS NOT NULL AND OBJECT_ID(p.line_table, 'U') IS NOT NULL
  AND f.col_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.columns c WHERE c.object_id = OBJECT_ID(p.line_table) AND c.name = f.col_name);