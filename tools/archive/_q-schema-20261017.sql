-- 【只读】元数据表结构自检
SET NOCOUNT ON;
PRINT N'=== yj_field 列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'yj_field') ORDER BY c.column_id;
PRINT N'=== yj_panel 列 ===';
SELECT c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID(N'yj_panel') ORDER BY c.column_id;
PRINT N'=== rd_insp_plan_head / detail 列 ===';
SELECT OBJECT_NAME(c.object_id) AS tbl, c.column_id, c.name, t.name AS type, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id IN (OBJECT_ID(N'rd_insp_plan_head'), OBJECT_ID(N'rd_insp_plan_detail'))
ORDER BY tbl, c.column_id;
