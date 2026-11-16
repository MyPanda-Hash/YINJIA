SET NOCOUNT ON;
SELECT TOP 8 'S|' + 存货编码 + '|' + ISNULL(存货名称,N'') + '|' + ISNULL(仓库,N'') + '|' + ISNULL(仓库编码,N'') + '|' + ISNULL(批号,N'') + '|' + CAST(现存量 AS VARCHAR(20))
FROM v_stock_pick ORDER BY 现存量 DESC;
