SET NOCOUNT ON;
SELECT 'A.目录行' AS k, COUNT(*) AS total, SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END) AS canceled FROM qc_catalog_detail;
SELECT TOP 5 'B.样例' AS k, id, 检测物料类别, 物料名称, 物料编码, 批次号, 数量, 检验状态, 检验单号, 检验数据记录单号, asp_cancel FROM qc_catalog_detail ORDER BY id DESC;
SELECT TOP 3 'C.目录单' AS k, 单据编号, 单据日期 FROM qc_catalog;
GO
