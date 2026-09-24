SET NOCOUNT ON;
PRINT '== 头表列 vs 状态机 一致性全景(采购入库) ==';
SELECT h.单据状态 AS 头表状态, CASE WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'未审核' END AS 状态机, COUNT(*) AS n
  FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
 WHERE ISNULL(h.asp_cancel,'N')<>'Y'
 GROUP BY h.单据状态, CASE WHEN s.shr IS NOT NULL THEN N'已审核' ELSE N'未审核' END;
PRINT '== 冲突行清单(状态机已审核但头表非已审核) ==';
SELECT h.单据编号, h.单据日期, h.单据状态, s.shr FROM bd_purchase_in h
  JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
 WHERE ISNULL(h.asp_cancel,'N')<>'Y' AND s.shr IS NOT NULL AND h.单据状态 <> N'已审核'
 ORDER BY h.单据编号;
PRINT '== 流水视图单据类型分布 ==';
SELECT 单据类型, COUNT(*) AS 流水行数 FROM v_stock_movement GROUP BY 单据类型;
GO
