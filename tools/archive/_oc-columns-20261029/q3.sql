SET NOCOUNT ON;
SELECT TOP 10 o.单据编号, l.id, l.存货编码, l.存货名称, l.规格型号 AS 行规格, rv.规格型号 AS 档案规格, l.客户订单号
FROM bd_so_order o JOIN bl_so_order l ON l.单据编号=o.单据编号
LEFT JOIN bs_inv rv ON rv.存货编码=l.存货编码
WHERE o.单据编号 LIKE N'LZW-20261020-04%' ORDER BY l.id;
