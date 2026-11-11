SELECT DB_NAME() AS db;
SELECT COUNT(*) AS 待结转行 FROM bd_so_order o
 JOIN bl_so_order l ON l.[单据编号]=o.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
 JOIN yj_doc_status s ON s.panel_code='SO_ORDER' AND s.doc_no=o.[单据编号] AND s.shr IS NOT NULL
  AND ISNULL(s.canceled,'N')<>'Y' AND ISNULL(s.stopped,'N')<>'Y' AND ISNULL(s.erp_close_state,'') NOT IN ('H','S')
  AND ISNULL(s.deleting,'N')<>'Y' AND ISNULL(s.modify_state,'') NOT IN ('R','Y') AND ISNULL(s.pending,'N')<>'Y'
 WHERE ISNULL(o.asp_cancel,'N')<>'Y';
GO
SELECT TOP 5 o.[单据编号], COUNT(*) AS 行数, SUM(ISNULL(l.[数量],0)) AS 数量
FROM bd_so_order o JOIN bl_so_order l ON l.[单据编号]=o.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
GROUP BY o.[单据编号] HAVING COUNT(*)>=2 ORDER BY 行数 DESC;
GO
SELECT TOP 5 * FROM (SELECT 存货编码, 工艺路线 FROM bs_inv WHERE ISNULL(工艺路线,N'')<>N'') t;
GO
SELECT TOP 10 doc_no, shr, canceled, stopped, deleting, modify_state, pending FROM yj_doc_status WHERE panel_code='ROUTE';
GO
SELECT TOP 5 pl_no, pl_xc, od_no, od_xc, dm FROM plang ORDER BY id DESC;
GO
