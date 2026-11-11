SET NOCOUNT ON;
SELECT c.id, c.单据编号 AS 目录单, c.检验单号, c.检验数据记录单号, c.物料名称, c.批次号, c.检验状态, c.是否合格
FROM qc_catalog_detail c
WHERE c.检验状态 = N'已完成检验' AND ISNULL(c.asp_cancel,'N')<>'Y';
PRINT N'=== 这两行的挂靠单据状态 ===';
SELECT i.单据编号 AS 检验单, s.saved, s.canceled, s.archived FROM qc_insp i LEFT JOIN yj_doc_status s ON s.panel_code='QC_INSP' AND s.doc_no=i.单据编号;
