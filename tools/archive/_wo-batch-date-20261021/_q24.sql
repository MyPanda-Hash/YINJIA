SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name IN (N'批次号',N'批号',N'lot_no') AND t.is_ms_shipped=0
  AND t.name NOT LIKE N'[_]bak[_]%' ORDER BY t.name, c.name;
GO
