SET NOCOUNT ON;
SELECT N'qc_return' AS t, c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.qc_return') AND (c.name LIKE N'%ERP%' OR c.name LIKE N'%转%' OR c.name LIKE N'%来源%')
UNION ALL
SELECT N'qc_tc_in', c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.qc_tc_in') AND (c.name LIKE N'%ERP%' OR c.name LIKE N'%转%' OR c.name LIKE N'%来源%' OR c.name LIKE N'%入库%' OR c.name LIKE N'%退货%');
