-- 探针:BOM 面板与 bs_bom 表现状(决定是改造还是新建)
SELECT '=== 1. BOM 面板行 ===' AS x;
SELECT panel_code, panel_name, category, mode, line_table, head_table, pk_col, code_col, detail_key, module_group FROM yj_panel WHERE panel_code = 'BOM';
GO
SELECT '=== 2. BOM 面板字段 ===' AS x;
SELECT seq, col_name, label, data_type, place, visible, editable, required, ref_panel, ref_field
FROM yj_field WHERE panel_code = 'BOM' ORDER BY place, seq, id;
GO
SELECT '=== 3. bs_bom 列 ===' AS x;
SELECT c.column_id AS seq, c.name AS col, t.name AS typ, c.max_length AS len, c.is_nullable AS nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('bs_bom') ORDER BY c.column_id;
GO
SELECT '=== 4. bs_bom 行数 + 前 5 行 ===' AS x;
SELECT COUNT(*) AS rows_total FROM bs_bom;
GO
SELECT TOP 5 * FROM bs_bom ORDER BY id;
GO
SELECT '=== 5. 引用 bs_bom 的库对象/面板字段 ===' AS x;
SELECT name, type_desc FROM sys.objects WHERE OBJECT_DEFINITION(object_id) LIKE '%bs_bom%' AND type IN ('V','P','FN','TF','IF');
GO
SELECT panel_code, label, col_name, ref_panel, ref_field FROM yj_field WHERE ref_panel = 'BOM';
GO
SELECT '=== 6. mate(旧物料清单表)列数与行数 ===' AS x;
SELECT (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('mate')) AS cols, (SELECT COUNT(*) FROM mate) AS rows_total;
