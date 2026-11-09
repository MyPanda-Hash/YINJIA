SET NOCOUNT ON;
SELECT TOP 30 单据编号, 单据日期, 供应商编码, 是否已转ERP, ERP单号
FROM bd_pu_order WHERE 单据日期 BETWEEN '2026-10-26' AND '2026-10-29' ORDER BY 单据编号;
GO
SELECT TOP 30 h.单据编号, h.单据日期, l.物料编码, l.数量, l.单位
FROM bd_pu_order h JOIN bl_pu_order l ON l.单据编号 = h.单据编号
WHERE l.物料编码 = N'YJ-YCYX-012' ORDER BY h.单据日期 DESC;
GO
SELECT 单据编号, 单据日期, 采购订单号, 是否已转ERP, ERP单号 FROM bd_purchase_in
WHERE 单据日期 >= '2026-10-20' ORDER BY 单据编号;
GO
SELECT h.单据编号, h.单据日期, h.采购订单号, h.是否已转ERP, l.存货编码, l.实收数量, l.计量单位, l.源单行号
FROM bd_purchase_in h JOIN bl_purchase_in l ON l.单据编号 = h.单据编号
WHERE h.单据日期 >= '2026-10-20' ORDER BY h.单据编号;
