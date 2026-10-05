SET NOCOUNT ON;
SELECT '外键' AS 约束类型, COUNT(*) AS 数量 FROM sys.foreign_keys
UNION ALL SELECT '触发器', COUNT(*) FROM sys.triggers
UNION ALL SELECT '检查约束', COUNT(*) FROM sys.check_constraints
UNION ALL SELECT 'inv_cost_ledger 上的约束', COUNT(*) FROM sys.objects WHERE parent_object_id=OBJECT_ID('dbo.inv_cost_ledger') AND type IN ('F','C','TR');
GO
SELECT name AS 对象, type_desc AS 类型 FROM sys.objects WHERE parent_object_id IN (OBJECT_ID('dbo.inv_cost_ledger'), OBJECT_ID('dbo.v_stock_ledger')) ORDER BY 对象;
GO
SELECT i.name AS 索引, i.type_desc AS 类型, ISNULL(COL_NAME(ic.object_id, ic.column_id),'') AS 列, ic.key_ordinal AS 序号, ic.is_included_column AS 包含列
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
WHERE i.object_id=OBJECT_ID('dbo.inv_cost_ledger') ORDER BY i.index_id, ic.key_ordinal, ic.index_column_id;
GO
