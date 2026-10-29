SELECT TOP 2 l.id AS 行id, l.[采购订单行id] AS 采购订单行id, l.[采购订单行号] AS 采购订单行号,
       l.[物料编码] AS 物料编码, ISNULL(l.[打印数量],0) AS 打印数量, ISNULL(l.[补登], N'N') AS 补登,
       h.[单据编号] AS 单据编号, h.[批次号] AS 批次号, CONVERT(varchar(10), h.[生产日期], 120) AS 生产日期,
       ISNULL(h.[打印次数],0) AS 打印次数
FROM bl_pu_label l JOIN bd_pu_label h ON h.[单据编号] = l.[单据编号]
WHERE h.[采购订单号] = N'YJ-20261012-04' AND ISNULL(h.asp_cancel,'N') <> 'Y' AND ISNULL(l.asp_cancel,'N') <> 'Y'
ORDER BY h.[批次号], l.[采购订单行号], l.id;
