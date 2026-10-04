-- 探针:「物料清单」BOM 面板族下架前侦察(面板/字段/依赖对象/行数)
SELECT '=== 1. 相关面板 ===' AS x;
SELECT panel_code, panel_name, category, mode, head_table, line_table, group_col, code_col, detail_key, module_group
FROM yj_panel WHERE panel_code IN ('BOM','BOM_FWD','BOM_REV','WLBOM','WO_KIT','RD_ASM_BOM') ORDER BY panel_code;
GO
SELECT '=== 2. 这些面板的字段数 ===' AS x;
SELECT panel_code, COUNT(*) AS 字段数 FROM yj_field
WHERE panel_code IN ('BOM','BOM_FWD','BOM_REV','WLBOM','WO_KIT') GROUP BY panel_code;
GO
SELECT '=== 3. 引用 bs_bom / mate 的库对象(视图/存储过程/函数) ===' AS x;
SELECT o.name, o.type_desc
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%bs_bom%' OR m.definition LIKE '%[mate]%' OR m.definition LIKE '%bs_bom_head%'
ORDER BY o.name;
GO
SELECT '=== 4. 数据量 ===' AS x;
SELECT 'bs_bom' AS t, COUNT(*) AS n FROM bs_bom
UNION ALL SELECT 'mate', COUNT(*) FROM mate
UNION ALL SELECT 'v_wo_kit', COUNT(*) FROM v_wo_kit;
GO
SELECT '=== 5. 其它面板字段引用 BOM 面板作为参照源 ===' AS x;
SELECT panel_code, seq, label, place, ref_panel, ref_field FROM yj_field WHERE ref_panel IN ('BOM','BOM_FWD','BOM_REV','WLBOM') ORDER BY panel_code, seq;
GO
SELECT '=== 6. bs_bom 是否被其它表/默认约束/索引引用 ===' AS x;
SELECT OBJECT_NAME(parent_object_id) AS 对象, name AS 约束或索引, type_desc
FROM sys.objects WHERE OBJECT_NAME(parent_object_id) IN ('bs_bom') AND type IN ('F','D','C','PK','UQ');
