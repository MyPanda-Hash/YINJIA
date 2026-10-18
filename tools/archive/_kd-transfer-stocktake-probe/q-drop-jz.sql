SET NOCOUNT ON;
BEGIN TRAN;
DELETE FROM inh WHERE 单据类型=N'月结结转' AND 单据编号=N'JZ-202609';
COMMIT;
PRINT '=== 结转行清理后 ===';
SELECT COUNT(*) AS JZ行 FROM inh WHERE 单据编号=N'JZ-202609';
PRINT '=== bd_stock_close 恢复为备份状态 ===';
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计, 月结时间 FROM bd_stock_close;
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计 FROM bd_stock_close_bak_20261018;
