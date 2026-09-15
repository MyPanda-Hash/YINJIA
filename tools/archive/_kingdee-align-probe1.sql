-- 探针:基础档案面板清单与字段(任务:金蝶对齐基础档案)
SET NOCOUNT ON;
SELECT N'== PANELS ==' AS m;
SELECT panel_code + N' :: ' + panel_name + N' :: ' + ISNULL(line_table, N'') + N' :: cat=' + ISNULL(category,N'') + N' :: grp=' + ISNULL(module_group,N'')
FROM yj_panel WHERE module_group = N'基础档案' OR category = N'基础档案' ORDER BY panel_code;
SELECT N'== FIELDS ==' AS m;
SELECT f.panel_code + N' :: ' + f.col_name + N' :: ' + f.label + N' :: seq=' + CAST(f.seq AS nvarchar(5))
 + N' :: place=' + ISNULL(f.place,N'') + N' :: type=' + ISNULL(f.data_type,N'') + N' :: ref=' + ISNULL(f.ref_panel,N'') + N' :: req=' + CAST(f.required AS nvarchar(2))
FROM yj_field f JOIN yj_panel p ON p.panel_code = f.panel_code
WHERE p.module_group = N'基础档案' OR p.category = N'基础档案'
ORDER BY f.panel_code, f.seq;
