SET NOCOUNT ON;
SELECT 单据编号, 存货编码, 实收数量, 计量单位, 仓库, 批次号, ISNULL(asp_cancel,'N') c FROM bl_purchase_in
WHERE 单据编号 IN ('PI-2026-10-0024','PI-2026-10-0025','PI-2026-10-0026') ORDER BY 单据编号, id;
GO
SELECT 单据编号, 物料编码, 合格数量, 入库单号 FROM qc_insp_detail WHERE 单据编号 IN ('IJ-2026-09-0152','IJ-2026-10-0001','IJ-2026-10-0200') AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY 单据编号,id;
