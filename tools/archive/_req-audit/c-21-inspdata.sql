SET NOCOUNT ON;
SELECT COUNT(*) AS 检验单总数,
       SUM(CASE WHEN 暂收单号 IS NOT NULL AND 暂收单号<>N'' THEN 1 ELSE 0 END) AS 有暂收单号,
       SUM(CASE WHEN 检验员 IS NOT NULL AND 检验员<>N'' THEN 1 ELSE 0 END) AS 有检验员,
       SUM(CASE WHEN 总结论 IS NOT NULL AND 总结论<>N'' THEN 1 ELSE 0 END) AS 有总结论,
       SUM(CASE WHEN 检验方案 IS NOT NULL AND 检验方案<>N'' THEN 1 ELSE 0 END) AS 有检验方案,
       SUM(CASE WHEN 检验类型 IS NOT NULL AND 检验类型<>N'' THEN 1 ELSE 0 END) AS 有检验类型,
       SUM(CASE WHEN 执行标准 IS NOT NULL AND 执行标准<>N'' THEN 1 ELSE 0 END) AS 有执行标准,
       SUM(CASE WHEN 检验编号 IS NOT NULL AND 检验编号<>N'' THEN 1 ELSE 0 END) AS 有检验编号
FROM qc_insp;
GO
SELECT 单据状态, COUNT(*) AS n FROM qc_insp GROUP BY 单据状态;
GO
SELECT 单据状态, COUNT(*) AS n FROM sl_recv GROUP BY 单据状态;
GO
SELECT source_panel_code, target_panel_code, COUNT(*) AS n FROM form_flow_link GROUP BY source_panel_code, target_panel_code;
GO
SELECT TOP 5 * FROM yj_form_approval;
GO
SELECT panel_code, COUNT(*) AS n FROM yj_doc_status GROUP BY panel_code;
GO
