SET NOCOUNT ON;
DECLARE @cols nvarchar(max);
SELECT @cols = STUFF((SELECT ',' + QUOTENAME(name) FROM sys.columns WHERE object_id=OBJECT_ID('dbo.bd_stock_close') AND is_identity=0 ORDER BY column_id FOR XML PATH('')),1,1,'');
BEGIN TRAN;
DELETE FROM bd_stock_close;
EXEC('INSERT INTO bd_stock_close (' + @cols + ') SELECT ' + @cols + ' FROM bd_stock_close_bak_20261018');
COMMIT;
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计, 月结时间 FROM bd_stock_close;
PRINT '=== 最终校验 ===';
SELECT (SELECT COUNT(*) FROM kucun) 库存行, (SELECT SUM(yl) FROM kucun) 库存合计,
       (SELECT COUNT(*) FROM inh WHERE 单据编号 LIKE 'YCD%') 金蝶流水残留,
       (SELECT COUNT(*) FROM bd_transfer WHERE 单据编号 LIKE 'YCD%') 金蝶单据残留,
       (SELECT COUNT(*) FROM inh WHERE 单据类型=N'月结结转') 结转行;
