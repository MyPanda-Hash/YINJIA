SET NOCOUNT ON;
PRINT '=== inh 期初/月结 ===';
SELECT src, 单据类型, COUNT(*) n, MIN(单据日期) d1, MAX(单据日期) d2 FROM inh WHERE src=0 OR 单据类型 IN (N'月结结转',N'期初结存') GROUP BY src, 单据类型;
PRINT '=== 金蝶拉取的采购入库单 起止 ===';
SELECT MIN(单据日期) AS 最早, MAX(单据日期) AS 最晚, COUNT(*) AS 张数 FROM bd_purchase_in WHERE ISNULL([外部单据号],'')<>'';
SELECT TOP 3 [单据编号],[单据日期],[外部单据号] FROM bd_purchase_in WHERE ISNULL([外部单据号],'')<>'' ORDER BY 单据日期;
PRINT '=== 调拨/盘点流水(段9-12) ===';
SELECT 'inh' t, src, COUNT(*) n FROM inh WHERE src IN (9,11) GROUP BY src
UNION ALL SELECT 'outh', src, COUNT(*) FROM outh WHERE src IN (10,12) GROUP BY src;
