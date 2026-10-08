SET NOCOUNT ON;
SELECT c.column_id AS 序, c.name AS 列, ty.name AS 类型, c.max_length AS 字节
FROM sys.columns c JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.object_id=OBJECT_ID('dbo.bs_wh_loc') AND c.name NOT LIKE N'备用%' ORDER BY c.column_id;
SELECT N'备用列数' AS 项, COUNT(*) AS 值 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bs_wh_loc') AND name LIKE N'备用%';
GO