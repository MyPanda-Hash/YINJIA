SET NOCOUNT ON;
SELECT COUNT(*) AS 视图行数 FROM v_stock_balance;
SELECT TOP 3 仓库编码, 仓库, 存货编码, LEFT(存货,12) AS 存货, 主计量, 现存量, 结存金额 FROM v_stock_balance WHERE 现存量 <> 0;
