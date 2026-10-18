SET NOCOUNT ON;
PRINT '=== kucun == Σ流水(全部,排除结转) ===';
SELECT (SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转')
     - (SELECT SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 流水净额,
       (SELECT SUM(yl) FROM kucun) AS 库存合计;
PRINT '=== 9月末结转 vs 9月末流水净额 ===';
SELECT (SELECT SUM(数量) FROM inh WHERE 单据编号=N'JZ-202609') AS 结转,
       (SELECT SUM(数量) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期<'2026-10-01')
     - (SELECT SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期<'2026-10-01') AS 九月末流水净额;
PRINT '=== 调拨单最终状态 ===';
SELECT CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END 状态, COUNT(*) n
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
WHERE h.单据编号 LIKE N'YCD%' GROUP BY CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END;
