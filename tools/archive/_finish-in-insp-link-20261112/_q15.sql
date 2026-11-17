SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='scjl' AND (COLUMN_NAME LIKE N'%报工%' OR COLUMN_NAME IN (N'sc_no',N'gldh',N'工单行号',N'gxdm',N'lot_no',N'sl'));
SELECT TOP 3 * FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.scjl') AND name LIKE N'%报工%';
