SET NOCOUNT ON;
SELECT DB_NAME() AS db, CASE WHEN COL_LENGTH(N'dbo.bl_material_out', N'行号') IS NULL THEN 0 ELSE 1 END AS col_exists;
SELECT DB_NAME() AS db, col_name, label, place, seq, width, editable, visible FROM yj_field
 WHERE panel_code = 'MATERIAL_OUT' AND col_name = N'行号';
SELECT DB_NAME() AS db, COUNT(*) AS total_rows, SUM(CASE WHEN [行号] IS NULL THEN 1 ELSE 0 END) AS null_lineno
 FROM dbo.bl_material_out WHERE ISNULL(asp_cancel, 'N') <> 'Y';
SELECT TOP 3 [单据编号], [行号], [材料名称] FROM dbo.bl_material_out ORDER BY [单据编号], [行号];
SELECT COUNT(*) AS tr_cnt FROM yj_translation WHERE scope = 'field' AND ref_key = N'行号';
