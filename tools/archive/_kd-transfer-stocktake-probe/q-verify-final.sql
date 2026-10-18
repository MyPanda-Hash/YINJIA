SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM kucun) AS 库存行数, (SELECT SUM(yl) FROM kucun) AS 库存合计;
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计 FROM bd_stock_close;
SELECT (SELECT COUNT(*) FROM bd_transfer) AS 调拨单数, (SELECT COUNT(*) FROM inh WHERE 单据类型=N'月结结转') AS 结转行数;
