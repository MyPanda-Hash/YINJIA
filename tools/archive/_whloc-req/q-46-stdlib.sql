SET NOCOUNT ON;
SELECT c.name AS 列, ty.name AS 类型, c.max_length/2 AS 字符, c.is_nullable AS 可空
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.yj_std_lib') ORDER BY c.column_id;
GO
SELECT TOP 12 * FROM yj_std_lib ORDER BY lib_code, sort_no;
GO
SELECT lib_code AS 库编码, COUNT(*) AS 条目数 FROM yj_std_lib GROUP BY lib_code;
GO
SELECT panel_code AS 面板, label AS 字段, data_type AS 类型, dict_sql AS 库编码
FROM yj_field WHERE data_type=N'标准库';
GO