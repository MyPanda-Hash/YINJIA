SET NOCOUNT ON;
SELECT i.name, i.is_primary_key, i.is_unique, i.type_desc,
       STUFF((SELECT ','+c.name FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
               WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,'') AS cols
  FROM sys.indexes i WHERE i.object_id=OBJECT_ID('dbo.inv_cost_ledger');
SELECT COUNT(*) AS 行数 FROM dbo.inv_cost_ledger;
SELECT COUNT(*) AS 重复src_rid FROM (SELECT src, rid FROM dbo.inv_cost_ledger GROUP BY src, rid HAVING COUNT(*)>1) t;
