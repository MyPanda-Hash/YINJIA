SET NOCOUNT ON;
SELECT 期间, 状态, 结转单据编号, 结转日期, 行数 FROM bd_stock_close ORDER BY 期间;
PRINT '=== 10月业务 ===';
SELECT 'inh' t, src, COUNT(*) n FROM inh WHERE 单据日期>='2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY src
UNION ALL SELECT 'outh', src, COUNT(*) FROM outh WHERE 单据日期>='2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY src ORDER BY t, src;
