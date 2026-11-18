SET NOCOUNT ON;
SELECT i.name AS 索引, i.type_desc AS 类型, i.is_unique AS 唯一, c.name AS 列, ic.key_ordinal AS 序
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID(N'dbo.bs_asm_bom') AND i.name IS NOT NULL
ORDER BY i.name, ic.key_ordinal;
PRINT '--- mate 索引 ---';
SELECT i.name AS 索引, i.is_unique AS 唯一 FROM sys.indexes i WHERE i.object_id = OBJECT_ID(N'dbo.mate') AND i.name IS NOT NULL;
