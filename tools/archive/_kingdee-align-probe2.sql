-- 探针2:KHDA/YWYDA/ZDGL 字段 + 物理表列
SET NOCOUNT ON;
SELECT f.panel_code + N' :: ' + f.col_name + N' :: ' + f.label + N' :: seq=' + CAST(f.seq AS nvarchar(5))
 + N' :: place=' + ISNULL(f.place,N'') + N' :: type=' + ISNULL(f.data_type,N'') + N' :: ref=' + ISNULL(f.ref_panel,N'') + N' :: req=' + CAST(f.required AS nvarchar(2))
FROM yj_field f WHERE f.panel_code IN ('KHDA','YWYDA','ZDGL')
ORDER BY f.panel_code, f.seq;
SELECT N'== COLS dm_kh ==' AS m;
SELECT c.name + N' ' + t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dm_kh') ORDER BY c.column_id;
SELECT N'== COLS dm_gf ==' AS m;
SELECT c.name + N' ' + t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dm_gf') ORDER BY c.column_id;
SELECT N'== COLS dm_ywy ==' AS m;
SELECT c.name + N' ' + t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dm_ywy') ORDER BY c.column_id;
SELECT N'== COLS dm_ck ==' AS m;
SELECT c.name + N' ' + t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dm_ck') ORDER BY c.column_id;
SELECT N'== COLS dm_gx ==' AS m;
SELECT c.name + N' ' + t.name FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('dm_gx') ORDER BY c.column_id;
