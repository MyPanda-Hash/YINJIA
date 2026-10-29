SET NOCOUNT ON;
SELECT TOP 3 o.单据编号 AS 订单号, l.id AS 行id,
       ISNULL(l.存货名称, N'') AS 品名, ISNULL(l.存货名称, N'') AS 产品名称,
       ISNULL(l.规格型号, N'') AS 型号
FROM bd_so_order o JOIN bl_so_order l ON l.单据编号=o.单据编号
WHERE ISNULL(o.asp_cancel,'N') <> 'Y' AND ISNULL(l.数量,0) > 0
ORDER BY o.单据日期 DESC;
