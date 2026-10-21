SET NOCOUNT ON;
SELECT 'qc_catalog' t, COUNT(*) n, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) canceled FROM qc_catalog
UNION ALL SELECT 'qc_catalog_detail', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) FROM qc_catalog_detail
UNION ALL SELECT 'qc_insp', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) FROM qc_insp
UNION ALL SELECT 'qc_insp_detail', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) FROM qc_insp_detail
UNION ALL SELECT 'qc_insp_rec', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) FROM qc_insp_rec
UNION ALL SELECT 'qc_insp_rec_detail', COUNT(*), SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) FROM qc_insp_rec_detail;

SELECT 单据编号, 单据日期, asp_user1, asp_time1, 备注 FROM qc_catalog ORDER BY id;
GO
SELECT TOP 50 单据编号, 物料编码, 物料名称, 批次号, 数量, 计量单位, 检验状态, 是否合格, 检验单号, 检验数据记录单号, asp_cancel, asp_time1
FROM qc_catalog_detail ORDER BY id;
