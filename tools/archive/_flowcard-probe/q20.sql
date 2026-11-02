SET NOCOUNT ON;
SELECT i.name, c.name AS col FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id=i.object_id AND ic.index_id=i.index_id
JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE i.object_id=OBJECT_ID('dbo.wo_proc_card_head') ORDER BY i.name, ic.key_ordinal;
