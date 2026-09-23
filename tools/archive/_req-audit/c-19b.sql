SET NOCOUNT ON;
SELECT COUNT(*) AS bl_purchase_in行数 FROM bl_purchase_in;
GO
SELECT COUNT(*) AS 批号空 FROM bl_purchase_in WHERE 批号 IS NULL OR 批号 = N'';
GO
SELECT ISNULL(是否已转ERP, N'(空)') AS 是否已转ERP, COUNT(*) AS n FROM bd_purchase_in GROUP BY 是否已转ERP;
GO
SELECT TOP 6 单据编号 AS 检验单号, 暂收单号, 采购订单号, 批次号, 单据状态, 检验员 FROM qc_insp ORDER BY id DESC;
GO
