-- 探针:bs_bom / v_wo_kit 的准确依赖(只按 bs_bom 字面匹配,避免上次 [mate] 字符类误报)
SELECT '=== 1. 定义里出现 bs_bom 的对象 ===' AS x;
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%bs_bom%' ORDER BY o.name;
GO
SELECT '=== 2. 定义里出现 v_wo_kit 的对象 ===' AS x;
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%v_wo_kit%' ORDER BY o.name;
GO
SELECT '=== 3. 定义里出现 [mate] 表(精确写法)的对象 ===' AS x;
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE '%from mate%' OR m.definition LIKE '%FROM mate%' OR m.definition LIKE '%join mate%' OR m.definition LIKE '%JOIN mate%'
   OR m.definition LIKE '%[mate]%' AND o.name IN ('WLBOM') ORDER BY o.name;
GO
SELECT '=== 4. WO_KIT 面板与 v_wo_kit 现状 ===' AS x;
SELECT (SELECT COUNT(*) FROM v_wo_kit) AS v_wo_kit行数,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'WO_KIT') AS WO_KIT字段,
       (SELECT COUNT(*) FROM yj_field WHERE panel_code = 'WLBOM') AS WLBOM字段,
       (SELECT COUNT(*) FROM mate) AS mate行数;
GO
SELECT '=== 5. 面板译名(两个面板都叫「物料清单」) ===' AS x;
SELECT panel_code, panel_name FROM yj_panel WHERE panel_name = N'物料清单';
SELECT scope, ref_key, locale, text FROM yj_translation WHERE ref_key = N'物料清单' ORDER BY scope, locale;
