SELECT TOP 10 h.单据编号, h.供应商编码, h.是否已转ERP, h.ERP单号, d.存货编码, d.实收数量, d.仓库编码, d.仓库名称
FROM bd_purchase_in h JOIN bl_purchase_in d ON d.单据编号=h.单据编号
LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
WHERE s.shr IS NOT NULL AND ISNULL(h.是否已转ERP,N'否')<>N'是' AND ISNULL(h.asp_cancel,'N')<>'Y'
ORDER BY h.单据编号 DESC
GO
SELECT TOP 10 单据编号, 供应商编码, 是否已转ERP, ERP单号 FROM bd_purchase_in ORDER BY id DESC
