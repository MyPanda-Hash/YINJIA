SET NOCOUNT ON;
SELECT TOP 3 id, 仓库编码, 仓库, 存货编码, 存货, 现存量, 结存金额 FROM dbo.v_stock_balance ORDER BY id DESC;
