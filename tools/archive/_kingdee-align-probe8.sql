-- 探针8:全部"基础"类面板清点(分类/分组口径)
SET NOCOUNT ON;
SELECT panel_code + N' :: ' + panel_name + N' :: cat=' + category + N' :: grp=' + ISNULL(module_group,N'') + N' :: tbl=' + ISNULL(line_table,N'')
FROM yj_panel
WHERE category LIKE N'基础%' OR module_group LIKE N'基础%'
ORDER BY module_group, panel_code;
