SET NOCOUNT ON;
PRINT '=== 当前金蝶调拨单状态 ===';
SELECT h.单据编号, h.单据日期, CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END 状态
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
WHERE h.单据编号 LIKE N'YCD%' ORDER BY h.单据日期;
PRINT '=== kucun 总量 ===';
SELECT COUNT(*) 行数, SUM(yl) 合计 FROM kucun;
