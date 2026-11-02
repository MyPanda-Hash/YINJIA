SET NOCOUNT ON;
SELECT t.name AS tbl, c.name AS col, ty.name AS typ
FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id
WHERE c.name IN (N'批次号',N'批号',N'lot_no') AND t.is_ms_shipped=0
ORDER BY t.name, c.name;
GO
