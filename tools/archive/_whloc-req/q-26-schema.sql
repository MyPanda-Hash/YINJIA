SET NOCOUNT ON;
SELECT t.name AS 表, c.name AS 列, ty.name AS 类型, c.max_length AS 字节
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE t.name IN (N'yj_field',N'yj_panel') ORDER BY t.name, c.column_id;
GO