SELECT TOP 5 h.单据编号, h.采购订单号, h.批次号, CONVERT(varchar(10), h.生产日期, 120) AS 生产日期, h.打印次数
FROM bd_pu_label h WHERE ISNULL(h.asp_cancel,'N') <> 'Y' ORDER BY h.id DESC;
