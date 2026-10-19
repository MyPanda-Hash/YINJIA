SET NOCOUNT ON;
SELECT c.name AS 列, t.name AS 类型, c.max_length, c.is_nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id = OBJECT_ID('dbo.inv_cost_ledger') ORDER BY c.column_id;
SELECT N'--- PK ---' AS x;
SELECT k.name AS 约束, i.type_desc,
       STUFF((SELECT ',' + c.name FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
               WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0
               ORDER BY ic.key_ordinal FOR XML PATH('')),1,1,'') AS 键列
  FROM sys.key_constraints k JOIN sys.indexes i ON i.object_id=k.parent_object_id AND i.index_id=k.unique_index_id
 WHERE k.parent_object_id = OBJECT_ID('dbo.inv_cost_ledger');
