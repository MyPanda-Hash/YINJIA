-- 探针:head+detail 面板模板(RD_ASM_BOM)+ 基础设置模块下的 doc 面板分布
SELECT '=== 1. RD_ASM_BOM(head+detail 现成模板)面板行 ===' AS x;
SELECT panel_code, panel_name, panel_name_en, category, mode, head_table, line_table, group_col, pk_col, code_col, prefix, date_col, page_size, detail_key, module_group FROM yj_panel WHERE panel_code = 'RD_ASM_BOM';
GO
SELECT '=== 2. RD_ASM_BOM 字段(place 分布) ===' AS x;
SELECT place, COUNT(*) AS n FROM yj_field WHERE panel_code = 'RD_ASM_BOM' GROUP BY place;
GO
SELECT '=== 3. RD_ASM_BOM 表头字段(前 20) ===' AS x;
SELECT seq, col_name, label, data_type, place, visible, editable, required, ref_panel, ref_field
FROM yj_field WHERE panel_code = 'RD_ASM_BOM' AND place LIKE '%header%' ORDER BY seq, id;
GO
SELECT '=== 4. 基础设置模块下 mode 分布 ===' AS x;
SELECT module_group, mode, COUNT(*) AS panels FROM yj_panel GROUP BY module_group, mode ORDER BY module_group, mode;
GO
SELECT '=== 5. bs_bom 现有列的中文扩展属性(注明现状) ===' AS x;
SELECT c.name AS col, CAST(ep.value AS nvarchar(200)) AS comment
FROM sys.columns c
LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('bs_bom') ORDER BY c.column_id;
