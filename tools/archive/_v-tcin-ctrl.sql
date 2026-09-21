SET NOCOUNT ON;
PRINT '=== 对照:QC_TC 存量行(业务字段是否有值) ===';
SELECT TOP 8 id, 单据编号, 供应商, 采购单号, 产品名称, 总数量, 单据状态 FROM qc_tc ORDER BY id DESC;
GO
SELECT COUNT(*) AS 总行数, SUM(CASE WHEN 采购单号 IS NOT NULL THEN 1 ELSE 0 END) AS 采购单号非空 FROM qc_tc;
GO
PRINT '=== qc_tc_in 本次新建 ===';
SELECT id, 单据编号, 采购单号, 产品名称, 总数量, 单据状态 FROM qc_tc_in ORDER BY id DESC;
GO
