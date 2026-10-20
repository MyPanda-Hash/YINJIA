SELECT TOP 8 d.单据编号, r.供应商, r.仓库, d.物料编码, d.计量单位, d.退货数量, r.单据状态, s.shr
FROM qc_return_detail d JOIN qc_return r ON r.单据编号=d.单据编号
LEFT JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=r.单据编号
WHERE s.shr IS NOT NULL AND ISNULL(d.asp_cancel,'N')<>'Y' AND ISNULL(r.asp_cancel,'N')<>'Y'
ORDER BY d.单据编号 DESC
GO
SELECT TOP 5 物料编码, 计量单位, 退货数量 FROM qc_return_detail WHERE 单据编号 IN (SELECT TOP 1 单据编号 FROM qc_return_detail d JOIN yj_doc_status s ON s.panel_code='QC_RETURN' AND s.doc_no=d.单据编号 WHERE s.shr IS NOT NULL ORDER BY d.单据编号 DESC)
