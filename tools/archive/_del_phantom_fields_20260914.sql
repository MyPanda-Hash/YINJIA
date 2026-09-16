USE HSDZ_MES;
SET NOCOUNT ON;
DELETE f FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE (
  (f.place LIKE '%detail%' AND p.line_table IS NOT NULL AND COL_LENGTH(p.line_table, f.col_name) IS NULL)
  OR (f.place LIKE '%header%' AND p.head_table IS NOT NULL AND p.head_table <> p.line_table
      AND COL_LENGTH(p.head_table, f.col_name) IS NULL AND COL_LENGTH(p.line_table, f.col_name) IS NULL)
) AND f.col_name <> 'id';
SELECT @@ROWCOUNT AS deleted;
