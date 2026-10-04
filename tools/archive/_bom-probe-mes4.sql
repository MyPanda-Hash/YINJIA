-- 探针:三个基础资料类模块组下的面板(确认 BOM 该归哪一组)
SELECT '=== 基础档案 ===' AS x;
SELECT panel_code, panel_name, mode, line_table, module_group FROM yj_panel WHERE module_group = N'基础档案' ORDER BY panel_code;
GO
SELECT '=== 基础设置 ===' AS x;
SELECT panel_code, panel_name, mode, line_table, module_group FROM yj_panel WHERE module_group = N'基础设置' ORDER BY panel_code;
GO
SELECT '=== 基础资料 ===' AS x;
SELECT panel_code, panel_name, mode, line_table, module_group FROM yj_panel WHERE module_group = N'基础资料' ORDER BY panel_code;
GO
SELECT '=== 全部模块组 ===' AS x;
SELECT module_group, COUNT(*) AS panels FROM yj_panel GROUP BY module_group ORDER BY module_group;
