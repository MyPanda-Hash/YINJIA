/* 采购入库单是否存有采购订单号:列清单 + yj_field 注册 + 实际填充率 */
SET NOCOUNT ON;
PRINT '== ① 头表 bd_purchase_in 的订单/源单类列 ==';
SELECT c.name FROM sys.columns c
 WHERE c.object_id = OBJECT_ID('bd_purchase_in')
   AND (c.name LIKE N'%订单%' OR c.name LIKE N'%源单%' OR c.name LIKE N'%外部%' OR c.name LIKE N'%单号%')
 ORDER BY c.column_id;
GO
PRINT '== ② 行表 bl_purchase_in 的订单/源单类列 ==';
SELECT c.name FROM sys.columns c
 WHERE c.object_id = OBJECT_ID('bl_purchase_in')
   AND (c.name LIKE N'%订单%' OR c.name LIKE N'%源单%' OR c.name LIKE N'%单号%')
 ORDER BY c.column_id;
GO
PRINT '== ③ yj_field 注册(PURCHASE_IN,订单/源单类) ==';
SELECT col_name, label, place, hidden, visible FROM yj_field
 WHERE panel_code = 'PURCHASE_IN' AND (col_name LIKE N'%订单%' OR col_name LIKE N'%源单%' OR col_name LIKE N'%外部%')
 ORDER BY place, seq;
GO
PRINT '== ④ 实际数据填充率(已审核+未作废) ==';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN h.[采购订单号] IS NOT NULL AND h.[采购订单号] <> '' THEN 1 ELSE 0 END) AS 头有采购订单号,
       SUM(CASE WHEN l.[采购订单行号] IS NOT NULL AND l.[采购订单行号] <> '' THEN 1 ELSE 0 END) AS 行有采购订单行号,
       SUM(CASE WHEN h.[外部单据号] IS NOT NULL AND h.[外部单据号] <> '' THEN 1 ELSE 0 END) AS 头有外部单据号
  FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y';
GO
PRINT '== ⑤ 头表采购订单号与外部单据号实际样例(前 5) ==';
SELECT TOP 5 h.[单据编号], h.[采购订单号], h.[外部单据号], l.[采购订单行号], l.[物料编码]
  FROM bd_purchase_in h LEFT JOIN bl_purchase_in l ON l.[单据编号] = h.[单据编号]
 WHERE ISNULL(h.asp_cancel,'N') <> 'Y' ORDER BY h.id DESC;
GO
