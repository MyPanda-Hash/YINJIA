SET NOCOUNT ON;
PRINT '== bd_pu_order / bd_so_order 的索引 ==';
SELECT OBJECT_NAME(i.object_id) AS 表, i.name AS 索引名, i.type_desc AS 类型, i.is_unique AS 唯一,
       i.is_primary_key AS 主键,
       STUFF((SELECT N',' + c.name FROM sys.index_columns ic
               JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
              WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id
              ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, N'') AS 列
FROM sys.indexes i
WHERE i.object_id IN (OBJECT_ID('dbo.bd_pu_order'), OBJECT_ID('dbo.bd_so_order'), OBJECT_ID('dbo.bl_pu_order'), OBJECT_ID('dbo.bl_so_order'))
ORDER BY 表, i.index_id;
GO
PRINT '== 单据编号 是否有唯一约束/索引(直接试重号看是否有约束名) ==';
SELECT OBJECT_NAME(parent_object_id) AS 表, name AS 约束名, type_desc
FROM sys.objects WHERE type IN ('UQ','PK') AND OBJECT_NAME(parent_object_id) IN ('bd_pu_order','bd_so_order');
