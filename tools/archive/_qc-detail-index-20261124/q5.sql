SET NOCOUNT ON;
SELECT TOP 20 单据编号, 单据日期, ISNULL(asp_cancel,'N') AS cancel, 供应商, 批次号 FROM qc_insp ORDER BY id DESC;
SELECT TOP 20 单据编号, 单据日期, ISNULL(asp_cancel,'N') AS cancel, 物料名称, 物料批次, 来料检验单号 FROM qc_insp_rec ORDER BY id DESC;
SELECT TOP 20 id, 单据编号, 物料名称, 物料编码, 批次号, 检验状态, 检验单号, 检验数据记录单号, ISNULL(asp_cancel,'N') AS cancel FROM qc_catalog_detail ORDER BY id DESC;
