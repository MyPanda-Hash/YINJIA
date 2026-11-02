SET NOCOUNT ON;
SELECT id, 检验单号, 检验数据记录单号, 物料编码, 数量, 计量单位 FROM qc_catalog_detail
WHERE ISNULL(asp_cancel,'N')<>'Y'
AND EXISTS(SELECT 1 FROM qc_insp h JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号
           WHERE h.单据编号=qc_catalog_detail.检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'
             AND dt.物料编码=qc_catalog_detail.物料编码 AND ISNULL(dt.asp_cancel,'N')<>'Y');
GO
SELECT 单据编号, ISNULL(asp_cancel,'N') c FROM qc_insp WHERE 单据编号 IN ('IJ-2026-09-0006','IJ-2026-09-0007','IJ-2026-09-0008','IJ-2026-09-0009','IJ-2026-09-0010','IJ-2026-10-0200');
