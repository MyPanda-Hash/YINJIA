SET NOCOUNT ON;
PRINT '== 订单本体状态 ==';
SELECT h.[单据编号], st.shr, CASE WHEN st.canceled='Y' THEN N'已作废' WHEN st.shr IS NOT NULL THEN N'已审核' ELSE N'未审核' END AS 状态
  FROM bd_pu_order h LEFT JOIN yj_doc_status st ON st.panel_code='PU_ORDER' AND st.doc_no=h.[单据编号]
 WHERE h.[单据编号] = N'YJ-20260909-01';
GO
PRINT '== 该订单下的采购入库单 ==';
SELECT h.[单据编号], h.[单据日期], h.[是否已转ERP], h.[ERP单号], st.shr,
       CASE WHEN st.canceled='Y' THEN N'已作废' WHEN st.shr IS NOT NULL THEN N'已审核' ELSE N'未审核' END AS 状态,
       (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.[单据编号]=h.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y') AS 行数,
       (SELECT COUNT(*) FROM bl_purchase_in l WHERE l.[单据编号]=h.[单据编号] AND ISNULL(l.asp_cancel,'N')<>'Y'
          AND ISNULL(l.[仓库编码],'')<>'') AS 行有仓库编码
  FROM bd_purchase_in h LEFT JOIN yj_doc_status st ON st.panel_code='PURCHASE_IN' AND st.doc_no=h.[单据编号]
 WHERE h.[采购订单号] = N'YJ-20260909-01' AND ISNULL(h.asp_cancel,'N') <> 'Y'
 ORDER BY h.[单据编号];
GO
