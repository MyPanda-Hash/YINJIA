SET NOCOUNT ON;
PRINT '=== MES 现有 调拨/盘点 单据(全部) ===';
SELECT [单据编号], [业务类型], [单据日期], asp_cancel FROM bd_transfer ORDER BY 单据日期;
SELECT [单据编号], [业务类型], [单据日期], asp_cancel FROM bd_stocktake ORDER BY 单据日期;
PRINT '=== MES 9月 出入库流水按段号 ===';
SELECT 'inh' AS t, src, COUNT(*) n, MIN(单据日期) d1, MAX(单据日期) d2 FROM inh WHERE 单据日期 >= '2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY src
UNION ALL
SELECT 'outh', src, COUNT(*), MIN(单据日期), MAX(单据日期) FROM outh WHERE 单据日期 >= '2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y' GROUP BY src
ORDER BY t, src;
PRINT '=== 9月 MES 各类单据张数 ===';
SELECT N'采购入库' AS 单据, COUNT(*) n FROM bd_purchase_in WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'销售出库', COUNT(*) FROM bd_sale_out WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'材料出库', COUNT(*) FROM bd_material_out WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'产成品入库', COUNT(*) FROM bd_finish_in WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'其他入库', COUNT(*) FROM bd_other_in WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'其他出库', COUNT(*) FROM bd_other_out WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'调拨单', COUNT(*) FROM bd_transfer WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'盘点单', COUNT(*) FROM bd_stocktake WHERE 单据日期>='2026-09-01' AND ISNULL(asp_cancel,'N')<>'Y';
