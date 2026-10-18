SET NOCOUNT ON;
PRINT '=== v_stock_movement 定义 ===';
SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.v_stock_movement')) AS def;
PRINT '=== inh/outh 索引 ===';
SELECT i.name, i.is_unique, COL_NAME(ic.object_id, ic.column_id) AS col
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
WHERE i.object_id IN (OBJECT_ID('dbo.inh'),OBJECT_ID('dbo.outh')) ORDER BY i.name, ic.key_ordinal;
PRINT '=== 现役前缀 ===';
SELECT prefix, COUNT(*) n FROM yj_panel WHERE prefix IS NOT NULL AND prefix<>'' GROUP BY prefix ORDER BY prefix;
