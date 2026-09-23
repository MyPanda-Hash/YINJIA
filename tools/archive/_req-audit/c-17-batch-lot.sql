SET NOCOUNT ON;
-- 批号/批次号 字段注册情况(三单+入库)
SELECT panel_code, col_name, label, place, hidden, visible, editable
FROM yj_field
WHERE col_name IN (N'批号', N'批次号') AND panel_code IN ('QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','OTHER_IN','OTHER_OUT')
ORDER BY panel_code, col_name, place;
GO
-- 数据抽查:三单+入库 批次号/批号 有值情况
SELECT 'sl_recv' AS t, COUNT(*) AS 行数, SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) AS 批次号空 FROM sl_recv
UNION ALL SELECT 'sl_recv_detail', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM sl_recv_detail
UNION ALL SELECT 'sl_recv_detail批号', COUNT(*), SUM(CASE WHEN 批号 IS NULL OR 批号='' THEN 1 ELSE 0 END) FROM sl_recv_detail
UNION ALL SELECT 'qc_insp', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM qc_insp
UNION ALL SELECT 'qc_insp_detail批次号', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM qc_insp_detail
UNION ALL SELECT 'qc_insp_detail批号', COUNT(*), SUM(CASE WHEN 批号 IS NULL OR 批号='' THEN 1 ELSE 0 END) FROM qc_insp_detail
UNION ALL SELECT 'bl_purchase_in批次号', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM bl_purchase_in
UNION ALL SELECT 'bl_purchase_in批号', COUNT(*), SUM(CASE WHEN 批号 IS NULL OR 批号='' THEN 1 ELSE 0 END) FROM bl_purchase_in
UNION ALL SELECT 'qc_return', COUNT(*), SUM(CASE WHEN 批次号 IS NULL OR 批次号='' THEN 1 ELSE 0 END) FROM qc_return;
GO
-- 采购入库单转ERP情况
SELECT ISNULL(是否已转ERP,N'(空)') AS 是否已转ERP, COUNT(*) AS n FROM bd_purchase_in GROUP BY 是否已转ERP;
GO
-- 三单关联字段串联样本(证明链路)
SELECT TOP 5 s.单据编号 AS 暂收单, s.采购订单号, s.批次号, i.单据编号 AS 检验单, i.总结论, p.单据编号 AS 入库单
FROM sl_recv s LEFT JOIN qc_insp i ON i.暂收单号 = s.单据编号
LEFT JOIN bd_purchase_in p ON p.外部单据号 = i.单据编号
ORDER BY s.id DESC;
GO
