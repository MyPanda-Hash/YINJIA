-- 探针3:INV/WH/DEPT/EMP/UOM/PARTNER 面板与字段 + 翻译现状
SET NOCOUNT ON;
SELECT panel_code + N' :: ' + panel_name + N' :: ' + ISNULL(line_table,N'') + N' :: grp=' + ISNULL(module_group,N'') + N' :: cat=' + ISNULL(category,N'')
FROM yj_panel WHERE panel_code IN ('INV','WH','DEPT','EMP','UOM','PARTNER','KHDA','GFDA','YWYDA','CKDA') ORDER BY panel_code;
SELECT N'== FIELDS ==' AS m;
SELECT f.panel_code + N' :: ' + f.col_name + N' :: ' + f.label + N' :: seq=' + CAST(f.seq AS nvarchar(5)) + N' :: req=' + CAST(f.required AS nvarchar(2)) + N' :: type=' + ISNULL(f.data_type,N'')
FROM yj_field f WHERE f.panel_code IN ('INV','WH','DEPT','EMP','UOM','PARTNER')
ORDER BY f.panel_code, f.seq;
SELECT N'== REFS TO KHDA/GFDA/YWYDA/CKDA ==' AS m;
SELECT f.panel_code + N' :: ' + f.label + N' :: ref=' + ISNULL(f.ref_panel,N'') + N' :: refField=' + ISNULL(f.ref_field,N'') + N' :: disp=' + ISNULL(f.display_field,N'')
FROM yj_field f WHERE f.ref_panel IN ('KHDA','GFDA','YWYDA','CKDA','INV','WH','DEPT','EMP','UOM');
