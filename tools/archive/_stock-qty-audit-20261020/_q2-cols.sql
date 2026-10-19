SET NOCOUNT ON;
PRINT N'== A. 物理表/视图中含「现存量」列的清单 ==';
SELECT s.name AS sch, o.name AS obj, o.type_desc, c.name AS col, t.name AS typ, c.precision, c.scale
FROM sys.columns c
JOIN sys.objects o ON c.object_id=o.object_id
JOIN sys.schemas s ON o.schema_id=s.schema_id
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.name LIKE N'%现存量%'
ORDER BY o.type_desc, o.name;

PRINT N'== B. 库存相关表里所有「数量/量」类列(物理列) ==';
SELECT o.name AS obj, c.name AS col, t.name AS typ, c.precision, c.scale
FROM sys.columns c
JOIN sys.objects o ON c.object_id=o.object_id
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE o.type='U' AND (c.name LIKE N'%数量%' OR c.name LIKE N'%存量%' OR c.name LIKE N'%结存%' OR c.name LIKE N'%可用%' OR c.name LIKE N'%预警%' OR c.name LIKE N'%余量%' OR c.name IN (N'yl',N'rkl',N'ckl',N'qty',N'数量',N'库存量'))
ORDER BY o.name, c.column_id;
