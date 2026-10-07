SET NOCOUNT ON;
SELECT SUM(现存量) AS 现存量合计, SUM(结存金额) AS 结存金额合计 FROM v_stock_balance;
GO
SELECT TOP 3 仓库, 存货编码, 存货, 现存量, 结存单价, 结存金额 FROM v_stock_balance ORDER BY 结存金额 DESC;
GO
