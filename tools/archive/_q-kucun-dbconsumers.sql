SET NOCOUNT ON;
SELECT o.name AS 数据库对象, o.type_desc AS 类型, LEN(m.definition) AS 定义长度
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id=m.object_id
WHERE m.definition LIKE '%kucun%' AND o.name <> 'kucun' ORDER BY o.type_desc, o.name;
GO
