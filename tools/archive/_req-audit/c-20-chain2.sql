SET NOCOUNT ON;
SELECT COUNT(*) AS qc_insp_detail行数, SUM(CASE WHEN 批号 IS NULL OR 批号=N'' THEN 1 ELSE 0 END) AS 批号空,
       SUM(CASE WHEN 批次号 IS NULL OR 批次号=N'' THEN 1 ELSE 0 END) AS 批次号空 FROM qc_insp_detail;
GO
SELECT COUNT(*) AS bl_purchase_in行数, SUM(CASE WHEN 批号 IS NULL OR 批号=N'' THEN 1 ELSE 0 END) AS 批号空,
       SUM(CASE WHEN 批次号 IS NULL OR 批次号=N'' THEN 1 ELSE 0 END) AS 批次号空 FROM bl_purchase_in;
GO
SELECT ISNULL(是否已转ERP, N'(空)') AS 是否已转ERP, COUNT(*) AS n FROM bd_purchase_in GROUP BY 是否已转ERP;
GO
SELECT TOP 6 单据编号 AS 检验单号, 暂收单号, 采购订单号, 批次号, 单据状态, 检验员 FROM qc_insp ORDER BY id DESC;
GO
SELECT TOP 6 s.单据编号 AS 暂收单, s.采购订单号, s.批次号, i.单据编号 AS 检验单, p.单据编号 AS 入库单
FROM sl_recv s LEFT JOIN qc_insp i ON i.暂收单号 = s.单据编号
LEFT JOIN bd_purchase_in p ON p.外部单据号 = i.单据编号 ORDER BY s.id DESC;
GO
