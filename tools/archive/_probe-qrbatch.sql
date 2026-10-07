SET NOCOUNT ON;
GO
PRINT '=== qr_batch_registry 结构 ===';
SELECT c.column_id, c.name AS col, t.name AS typ, c.max_length, c.is_nullable,
       ISNULL(CAST(ep.value AS nvarchar(300)), N'') AS 注明
FROM sys.columns c
JOIN sys.types t ON t.user_type_id = c.user_type_id
LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name = 'MS_Description'
WHERE c.object_id = OBJECT_ID('dbo.qr_batch_registry')
ORDER BY c.column_id;
GO
PRINT '=== 行数 / 样例 ===';
SELECT COUNT(*) AS 行数 FROM qr_batch_registry;
GO
SELECT TOP 20 * FROM qr_batch_registry ORDER BY id DESC;
GO
PRINT '=== 引用了 qr_batch_registry 的对象(视图/存储过程)==='; 
SELECT o.name, o.type_desc FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%qr_batch_registry%';
GO
