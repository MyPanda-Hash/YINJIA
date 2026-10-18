SET NOCOUNT ON;
PRINT '=== 月结结转(2026-10-01)覆盖了什么 ===';
SELECT COUNT(*) 行数, COUNT(DISTINCT 单据编号) 单号数, MIN(单据日期) d1 FROM inh WHERE 单据类型=N'月结结转';
PRINT '=== 期初结存(1900-01-01) ===';
SELECT COUNT(*) 行数 FROM inh WHERE 单据类型=N'期初结存';
PRINT '=== 9月流水 vs 月结结转:仓库存量是否已被结转吃掉 ===';
SELECT 'inh(9月各段)' AS seg, COUNT(*) n FROM inh WHERE 单据日期>='2026-09-01' AND 单据日期<'2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'outh(9月各段)', COUNT(*) FROM outh WHERE 单据日期>='2026-09-01' AND 单据日期<'2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'inh(10月)', COUNT(*) FROM inh WHERE 单据日期>='2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT 'outh(10月)', COUNT(*) FROM outh WHERE 单据日期>='2026-10-01' AND ISNULL(asp_cancel,'N')<>'Y';
PRINT '=== 月结头表 ===';
SELECT TOP 3 * FROM bd_stock_close;
