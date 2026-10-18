SET NOCOUNT ON;
PRINT '=== 还原 bd_stock_close ===';
DELETE FROM bd_stock_close;
SET IDENTITY_INSERT bd_stock_close ON;
INSERT INTO bd_stock_close SELECT * FROM bd_stock_close_bak_20261018;
SET IDENTITY_INSERT bd_stock_close OFF;
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计, 月结时间 FROM bd_stock_close;
PRINT '=== 最终状态校验 ===';
SELECT (SELECT COUNT(*) FROM kucun) 库存行, (SELECT SUM(yl) FROM kucun) 库存合计,
       (SELECT COUNT(*) FROM inh WHERE 单据编号 LIKE 'YCD%') 金蝶流水残留,
       (SELECT COUNT(*) FROM bd_transfer WHERE 单据编号 LIKE 'YCD%') 金蝶单据残留,
       (SELECT COUNT(*) FROM inh WHERE 单据类型=N'月结结转') 结转行;
