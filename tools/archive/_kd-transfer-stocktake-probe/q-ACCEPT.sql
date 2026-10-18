SET NOCOUNT ON;
PRINT '=== 1. kucun vs 流水(排除结转) ===';
SELECT (SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转')
     - (SELECT SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 流水净额,
       (SELECT SUM(yl) FROM kucun) AS 库存合计;
PRINT '=== 2. 9月末结转 vs 9月末流水净额 ===';
SELECT (SELECT SUM(数量) FROM inh WHERE 单据编号=N'JZ-202609') AS 结转总额,
       (SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期<'2026-10-01')
     - (SELECT SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期<'2026-10-01') AS 月末流水净额;
PRINT '=== 3. 金蝶调拨单 ===';
SELECT CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END 状态, COUNT(*) 张数
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
WHERE h.单据编号 LIKE N'YCD%' GROUP BY CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END;
PRINT '=== 4. 调拨流水对称 ===';
SELECT (SELECT SUM(数量) FROM inh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') 调入,
       (SELECT SUM(数量) FROM outh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') 调出;
PRINT '=== 5. 月结状态 ===';
SELECT 期间, 状态, 结转单据编号, 行数, 结存合计 FROM bd_stock_close;
