SET NOCOUNT ON;
SELECT source_panel_code, target_panel_code, link_status, COUNT(*) AS n
FROM form_flow_link GROUP BY source_panel_code, target_panel_code, link_status ORDER BY n DESC;
GO
SELECT COUNT(*) AS pi_total, SUM(CASE WHEN ERP单号 IS NULL OR ERP单号='' THEN 1 ELSE 0 END) AS not_pushed FROM bd_purchase_in;
GO
SELECT TOP 10 单据编号, 单据状态, ERP单号 FROM bd_purchase_in ORDER BY id DESC;
GO
SELECT COUNT(*) AS recv_total, SUM(CASE WHEN 单据状态=N'草稿' THEN 1 ELSE 0 END) AS draft FROM sl_recv;
GO
SELECT COUNT(*) AS insp_total, SUM(CASE WHEN 检验员 IS NULL OR 检验员='' THEN 1 ELSE 0 END) AS no_inspector, SUM(CASE WHEN 总结论 IS NULL OR 总结论='' THEN 1 ELSE 0 END) AS no_conclusion FROM qc_insp;
GO
SELECT COUNT(*) AS role_panel_rows FROM yj_role_panel;
