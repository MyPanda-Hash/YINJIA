SET NOCOUNT ON;

SELECT 'P|' + panel_code + '|' + panel_name + '|cat=' + ISNULL(category,'') + '|mode=' + ISNULL(mode,'') + '|grp=' + ISNULL(module_group,'') + '|en=' + ISNULL(panel_name_en,'') + '|head=' + ISNULL(head_table,'') + '|line=' + ISNULL(line_table,'')
FROM yj_panel
WHERE panel_name LIKE N'%生产领料%' OR panel_name LIKE N'%生产退料%' OR panel_name LIKE N'%材料出库%' OR panel_name LIKE N'%库存%'
ORDER BY panel_name;
