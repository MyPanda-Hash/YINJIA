SET NOCOUNT ON;
SELECT DB_NAME() AS db, c.COLUMN_NAME, c.DATA_TYPE, c.CHARACTER_MAXIMUM_LENGTH, c.IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME=N'wo_proc_card_head' ORDER BY c.ORDINAL_POSITION;
SELECT N'--- indexes ---' AS x;
SELECT i.name, i.is_unique, i.filter_definition FROM sys.indexes i
 WHERE i.object_id=OBJECT_ID(N'dbo.wo_proc_card_head');
