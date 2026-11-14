SET NOCOUNT ON;
PRINT N'=== 0. yj_panel 列 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_panel') ORDER BY c.column_id;
PRINT N'=== 0b. yj_field 列 ===';
SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_field') ORDER BY c.column_id;
