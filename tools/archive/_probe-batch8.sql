SET NOCOUNT ON;
GO
PRINT '=== yj_doc_batch 上的索引 ===';
SELECT i.name, i.is_unique, i.type_desc, ISNULL(i.filter_definition, N'(无)') AS filter_def
FROM sys.indexes i
WHERE i.object_id = OBJECT_ID('dbo.yj_doc_batch') AND i.type > 0
ORDER BY i.name;
GO
PRINT '=== 各索引的键列 ===';
SELECT i.name AS idx, ic.key_ordinal, COL_NAME(ic.object_id, ic.column_id) AS col, ic.is_included_column
FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.yj_doc_batch') AND i.type > 0
ORDER BY i.name, ic.key_ordinal, ic.is_included_column;
GO
PRINT '=== 该采购订单现有台账行 ===';
SELECT id, source_panel_code, source_form_no, batch_seq, batch_no, status
FROM yj_doc_batch WHERE source_form_no = N'YJ-20260916-03' ORDER BY id;
GO
