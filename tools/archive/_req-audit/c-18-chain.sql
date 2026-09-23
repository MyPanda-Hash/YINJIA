SET NOCOUNT ON;
SELECT 'sl_recv' AS t, COUNT(*) AS 行数, SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) AS 批次号空 FROM sl_recv
UNION ALL SELECT 'sl_recv_detail批次号', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM sl_recv_detail
UNION ALL SELECT 'sl_recv_detail批号', COUNT(*), SUM(CASE WHEN 批号 IS NULL OR 批号='' THEN 1 ELSE 0 END) FROM sl_recv_detail
UNION ALL SELECT 'qc_insp', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM qc_insp
UNION ALL SELECT 'qc_insp_detail批次号', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM qc_insp_detail
UNION ALL SELECT 'qc_insp_detail批号', COUNT(*), SUM(CASE WHEN 批号 IS NULL OR 批号='' THEN 1 ELSE 0 END) FROM qc_insp_detail
UNION ALL SELECT 'bl_purchase_in批次号', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM bl_purchase_in
UNION ALL SELECT 'bl_purchase_in批号', COUNT(*), SUM(CASE WHEN 批号 IS NULL OR 批号='' THEN 1 ELSE 0 END) FROM bl_purchase_in
UNION ALL SELECT 'qc_return', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM qc_return;
GO
SELECT ISNULL(是否已转ERP,N'(空)') AS 是否已转ERP, COUNT(*) AS n FROM bd_purchase_in GROUP BY 是否已转ERP;
GO
SELECT TOP 6 s.单据编号 AS 暂收单, s.采购订单号, s.批次号, i.单据编号 AS 检验单, i.总结论, p.单据编号 AS 入库单
FROM sl_recv s LEFT JOIN qc_insp i ON i.暂收单号 = s.单据编号
LEFT JOIN bd_purchase_in p ON p.外部单据号 = i.单据编号
ORDER BY s.id DESC;
GO
SELECT TOP 6 单据编号 AS 检验单号, 暂收单号, 采购订单号, 批次号, 单据状态, 检验员, 总结论 FROM qc_insp ORDER BY id DESC;
GO
