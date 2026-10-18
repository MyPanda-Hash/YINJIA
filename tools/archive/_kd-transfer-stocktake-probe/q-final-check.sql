SET NOCOUNT ON;
PRINT '=== 清理临时备份表(核对无误后) ===';
IF OBJECT_ID('dbo.kucun_bak_20261018') IS NOT NULL DROP TABLE dbo.kucun_bak_20261018;
IF OBJECT_ID('dbo.bd_stock_close_bak_20261018') IS NOT NULL DROP TABLE dbo.bd_stock_close_bak_20261018;
IF OBJECT_ID('dbo.inh_jz202609_bak') IS NOT NULL DROP TABLE dbo.inh_jz202609_bak;
PRINT '=== 最终状态 ===';
SELECT (SELECT COUNT(*) FROM kucun) 库存行, (SELECT SUM(yl) FROM kucun) 库存合计;
SELECT 期间, 状态, 行数, 结存合计 FROM bd_stock_close;
SELECT COUNT(*) AS 调拨单 FROM bd_transfer;
