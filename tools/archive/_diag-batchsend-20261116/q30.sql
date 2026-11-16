SET NOCOUNT ON;
SELECT OBJECT_NAME(i.object_id) AS 表, i.name AS 索引, i.is_unique AS 唯一,
       STUFF((SELECT N',' + c.name FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
              WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,N'') AS 列
FROM sys.indexes i WHERE OBJECT_NAME(i.object_id) IN ('bl_pu_order','bl_so_order') AND i.type>0;
