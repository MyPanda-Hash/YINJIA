SET NOCOUNT ON;
-- 面板名含 库存/查询/状况/台账/汇总 的面板
SELECT panel_code, panel_name, module_group, category, mode, line_table, head_table
FROM yj_panel
WHERE panel_name LIKE N'%库存%' OR panel_name LIKE N'%查询%' OR panel_name LIKE N'%台账%'
   OR panel_name LIKE N'%汇总%' OR panel_name LIKE N'%状况%' OR panel_name LIKE N'%收发存%'
ORDER BY module_group, panel_code;
GO
-- 菜单/导航相关表
SELECT name FROM sys.tables WHERE name LIKE 'yj_%' OR name LIKE 'menu%' OR name LIKE '%nav%' ORDER BY name;
GO
