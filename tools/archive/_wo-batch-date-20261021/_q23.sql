SET NOCOUNT ON;
SELECT COUNT(*) AS cols FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
WHERE c.name IN (N'批次号',N'批号',N'lot_no') AND t.is_ms_shipped=0;
GO
DECLARE @n int;
EXEC sp_executesql N'SELECT @n=COUNT(*) FROM dbo.scjl WHERE ISNULL([批次号],N'''')=N''20261014''', N'@n int OUTPUT', @n OUTPUT;
SELECT @n AS scjl_n;
GO
