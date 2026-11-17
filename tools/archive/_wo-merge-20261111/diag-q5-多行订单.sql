WITH p AS (
 SELECT o.[单据编号] AS 订单号, l.[id] AS 行id,
   ISNULL(l.[行号], 0) AS 行号, l.[存货编码] AS 物料编码, ISNULL(l.[存货名称],N'') AS 品名,
   ISNULL(l.[数量],0) AS 数量, ISNULL(l.[数量],0) - ISNULL(m.linked,0) AS 剩余,
   ISNULL(rv.[工艺路线], N'') AS 档案路线
 FROM bd_so_order o
 JOIN bl_so_order l ON l.[单据编号]=o.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
 LEFT JOIN bs_inv rv ON rv.[存货编码]=l.[存货编码] AND ISNULL(rv.asp_cancel,'N')<>'Y'
 JOIN yj_doc_status s ON s.panel_code='SO_ORDER' AND s.doc_no=o.[单据编号] AND s.shr IS NOT NULL
  AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.erp_close_state,'') NOT IN ('H','S')
  AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.modify_state,'') NOT IN ('R','Y') AND ISNULL(s.pending,'N')<>'Y'
 OUTER APPLY (SELECT SUM(ISNULL(linked_quantity,0)) AS linked FROM form_flow_link f
   WHERE f.source_panel_code='SO_ORDER' AND f.source_line_key = o.[单据编号]+N'#'+CAST(l.[id] AS nvarchar(20))
     AND f.target_panel_code IN ('MANU_ORDER','PLANG') AND f.link_status='ACTIVE') m
 WHERE ISNULL(o.asp_cancel,'N')<>'Y' AND ISNULL(l.[数量],0) - ISNULL(m.linked,0) > 0.0001
)
SELECT * FROM p WHERE 订单号 IN (
  SELECT TOP 3 订单号 FROM p GROUP BY 订单号 HAVING COUNT(*)>=3 ORDER BY COUNT(*) DESC)
ORDER BY 订单号, 行号;
GO
