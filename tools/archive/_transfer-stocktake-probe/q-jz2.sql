SET NOCOUNT ON;
SELECT COUNT(*) AS inh总数 FROM inh;
SELECT COUNT(*) AS 月结结转行 FROM inh WHERE 单据类型=N'月结结转';
SELECT COUNT(*) AS JZ单号行 FROM inh WHERE 单据编号 LIKE N'JZ%';
PRINT '=== bd_stock_close ===';
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计 FROM bd_stock_close;
PRINT '=== 期初结存(2026-08-31) ===';
SELECT COUNT(*) n, MIN(单据日期) d, SUM(数量) q FROM inh WHERE 单据类型=N'期初结存';
