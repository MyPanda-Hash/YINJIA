SET NOCOUNT ON;
GO
SELECT TOP 12 单据编号, 暂收单号, 采购订单号, 批次号 FROM qc_insp ORDER BY id DESC;
GO
SELECT N'检验单总数/暂收单号非空' AS 区块, COUNT(*) AS 总数, SUM(CASE WHEN ISNULL(暂收单号,N'')<>N'' THEN 1 ELSE 0 END) AS 有暂收单号 FROM qc_insp;
GO
