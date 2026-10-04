-- 探针:bs_bom 的依赖(v_wo_kit 等)+ 是否已有 archive 面板用 head_table 两层
SELECT '=== 1. v_wo_kit 定义 ===' AS x;
SELECT OBJECT_DEFINITION(OBJECT_ID('v_wo_kit')) AS def;
GO
SELECT '=== 2. 引用 mate / bs_bom 的库对象 ===' AS x;
SELECT name, type_desc FROM sys.objects
WHERE (OBJECT_DEFINITION(object_id) LIKE '%bs_bom%' OR OBJECT_DEFINITION(object_id) LIKE '%[mate]%')
  AND type IN ('V','P','FN','TF','IF');
GO
SELECT '=== 3. 所有 head_table 或 line_table 非空的面板 ===' AS x;
SELECT panel_code, panel_name, mode, head_table, line_table, code_col FROM yj_panel
WHERE head_table IS NOT NULL OR line_table IS NOT NULL ORDER BY mode, panel_code;
GO
SELECT '=== 4. 面板行数/字段统计:mode 分布 ===' AS x;
SELECT mode, COUNT(*) AS panels FROM yj_panel GROUP BY mode;
GOSELECT '=== 5. yj_panel 全列(确认可用列) ===' AS x;
SELECT * FROM yj_panel WHERE panel_code = 'BOM';
