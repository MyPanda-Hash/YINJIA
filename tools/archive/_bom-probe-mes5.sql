-- 探针:doc 面板里 date_col 为空的有哪些(判断没有单据日期的单据面板是否可行)
SELECT '=== doc 面板 date_col 情况 ===' AS x;
SELECT COUNT(*) AS doc_panels,
       SUM(CASE WHEN date_col IS NULL THEN 1 ELSE 0 END) AS date_col_null,
       SUM(CASE WHEN code_col IS NULL THEN 1 ELSE 0 END) AS code_col_null
FROM yj_panel WHERE mode = 'doc';
GO
SELECT '=== date_col 为空的 doc 面板 ===' AS x;
SELECT panel_code, panel_name, head_table, line_table, group_col, code_col, date_col, prefix, category, module_group
FROM yj_panel WHERE mode = 'doc' AND date_col IS NULL;
GO
SELECT '=== 参照:RD_ASM_BOM 全列 ===' AS x;
SELECT * FROM yj_panel WHERE panel_code = 'RD_ASM_BOM';
GO
SELECT '=== 参照:SO_ORDER 全列(金蝶同步单据) ===' AS x;
SELECT * FROM yj_panel WHERE panel_code = 'SO_ORDER';
GO
SELECT '=== 现有档案表的时间列类型(bs_material_group) ===' AS x;
SELECT c.name AS col, t.name AS typ, c.max_length AS len
FROM sys.columns c JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID('bs_material_group') ORDER BY c.column_id;
