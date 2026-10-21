SET NOCOUNT ON;
SELECT h.单据编号, h.单据日期, h.供应商, h.供应商编码, h.采购订单号, h.批次号, h.来源单号, h.单据状态,
       l.存货编码, l.实收数量, l.计量单位, l.单价, l.仓库, l.批次号 line_batch, l.是否来料检验
FROM bd_purchase_in h JOIN bl_purchase_in l ON l.单据编号=h.单据编号
WHERE h.单据编号 IN ('PI-2026-10-0024','PI-2026-10-0025','PI-2026-10-0026') ORDER BY h.单据编号,l.id;
GO
SELECT t.name, STUFF((SELECT ', '+c.name FROM sys.columns c WHERE c.object_id=t.object_id ORDER BY c.column_id FOR XML PATH(''),TYPE).value('.','nvarchar(max)'),1,2,'') cols
FROM sys.tables t WHERE t.name='sl_recv_detail';
