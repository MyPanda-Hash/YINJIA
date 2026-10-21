SET NOCOUNT ON;
SELECT h.单据编号, h.单据日期, h.供应商, h.来源单号, h.单据状态, ISNULL(h.asp_cancel,'N') c, s.shr, s.pending, s.archived, s.canceled
FROM bd_purchase_in h LEFT JOIN yj_doc_status s ON s.panel_code='PURCHASE_IN' AND s.doc_no=h.单据编号
WHERE h.单据编号 IN ('PI-2026-09-0146','PI-2026-10-0024','PI-2026-10-0025','PI-2026-10-0026') ORDER BY h.单据编号;
GO
SELECT 单据编号, 存货编码, 实收数量, 单位, 仓库, 批次号, ISNULL(asp_cancel,'N') c FROM bl_purchase_in
WHERE 单据编号 IN ('PI-2026-09-0146','PI-2026-10-0024','PI-2026-10-0025','PI-2026-10-0026') ORDER BY 单据编号, id;
GO
SELECT 单据编号, 物料编码, 合格数量, 入库单号 FROM qc_insp_detail WHERE 单据编号 IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号,id;
