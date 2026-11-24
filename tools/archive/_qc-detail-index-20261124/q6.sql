SET NOCOUNT ON;
SELECT TOP 10 单据编号 FROM qc_insp ORDER BY id DESC;
SELECT TOP 10 单据编号, 来料检验单号 FROM qc_insp_rec ORDER BY id DESC;
SELECT TOP 10 id, 检验单号, 检验数据记录单号, 检验状态 FROM qc_catalog_detail ORDER BY id DESC;
