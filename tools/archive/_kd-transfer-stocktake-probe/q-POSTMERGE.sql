SET NOCOUNT ON;
PRINT '=== 当前 kucun vs 流水(合并后复核) ===';
SELECT (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转')
     - (SELECT CAST(SUM(数量) AS decimal(18,4)) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y') AS 流水净额,
       (SELECT CAST(SUM(yl) AS decimal(18,4)) FROM kucun) AS 库存合计,
       (SELECT COUNT(*) FROM kucun) AS 库存行数;
PRINT '=== PC0000 是否已清零 ===';
SELECT COUNT(*) AS kucun_PC0000 FROM kucun WHERE lot_no='PC0000';
PRINT '=== 金蝶调拨单 ===';
SELECT CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END 状态, COUNT(*) n
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
WHERE h.单据编号 LIKE N'YCD%' GROUP BY CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END;
