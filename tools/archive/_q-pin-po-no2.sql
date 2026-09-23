/* 采购订单号填充率(修正:行表物理列=源单行号) */
SET NOCOUNT ON;
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN h.[采购订单号] IS NOT NULL AND h.[采购订单号] <> '' THEN 1 ELSE 0 END) AS 头有采购订单号,
       SUM(CASE WHEN l.[源单行号] IS NOT NULL AND l.[源单行号] <> '' THEN 1 ELSE 0 END) AS 行有源单行号,
       SUM(CASE WHEN h.[外部单据号] IS NOT NULL AND h.[外部单据号] <> '' THEN 1 ELSE 0 END) AS 头有外部单据号
  FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y';
GO
SELECT TOP 6 h.[单据编号], h.[采购订单号], h.[外部单据号], l.[源单行号], l.[物料编码]
  FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y' ORDER BY h.id DESC;
GO
