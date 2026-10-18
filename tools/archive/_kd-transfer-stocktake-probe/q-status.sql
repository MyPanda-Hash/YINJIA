SET NOCOUNT ON;
PRINT '=== 当前 调拨单 状态分布 ===';
SELECT CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END AS 状态, COUNT(*) n
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
GROUP BY CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END;
PRINT '=== 9月/10月 未审核的调拨单 ===';
SELECT h.单据编号, h.单据日期, CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END 状态
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
WHERE h.单据编号 LIKE N'YCD%' ORDER BY h.单据日期;
