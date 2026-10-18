SET NOCOUNT ON;
PRINT '=== 调拨单状态 ===';
SELECT h.单据编号, h.单据日期, CASE WHEN s.shr IS NULL THEN N'草稿' ELSE N'已审核' END 状态
FROM bd_transfer h LEFT JOIN yj_doc_status s ON s.panel_code='TRANSFER' AND s.doc_no=h.单据编号
WHERE h.单据编号 LIKE N'YCD%' ORDER BY h.单据日期;
PRINT '=== 流水对称性(调拨总量不变) ===';
SELECT (SELECT SUM(数量) FROM inh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') 调入,
       (SELECT SUM(数量) FROM outh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') 调出,
       (SELECT COUNT(DISTINCT 单据编号) FROM inh WHERE 单据编号 LIKE 'YCD%' AND ISNULL(asp_cancel,'N')<>'Y') 有流水单数;
PRINT '=== kucun 与流水对账 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
  UNION ALL SELECT 物料编码, 仓库编码, ISNULL(RTRIM(批号),N''), -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
), FS AS (SELECT ISNULL(RTRIM(w),N'') w, ISNULL(RTRIM(c),N'') c, l, SUM(q) q FROM F GROUP BY ISNULL(RTRIM(w),N''),ISNULL(RTRIM(c),N''),l),
K AS (SELECT wzdm w, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l, SUM(yl) yl FROM kucun GROUP BY wzdm,ISNULL(RTRIM(ckdm),N''),ISNULL(RTRIM(lot_no),N''))
SELECT SUM(CASE WHEN ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0))>0.01 THEN 1 ELSE 0 END) AS 超容差键,
       SUM(ISNULL(K.yl,0)) 库存侧, SUM(ISNULL(FS.q,0)) 流水侧
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND FS.l=K.l;
