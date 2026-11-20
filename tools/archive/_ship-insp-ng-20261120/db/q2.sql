SET NOCOUNT ON;
SELECT panel_code, panel_name, category, mode, head_table, line_table, module_group, prefix
FROM yj_panel
WHERE panel_name LIKE N'%出货%' OR panel_name LIKE N'%不合格%' OR panel_name LIKE N'%首件%'
   OR panel_name LIKE N'%巡线%' OR panel_name LIKE N'%来料检验%'
ORDER BY panel_name;
