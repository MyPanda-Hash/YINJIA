SET NOCOUNT ON;
PRINT N'=== 链路占用统计(按 source→target) ===';
SELECT TOP 30 source_panel_code AS 来源面板, target_panel_code AS 目标面板,
       COUNT(*) AS 条数,
       SUM(CASE WHEN link_status = N'ACTIVE' THEN 1 ELSE 0 END) AS 生效
FROM form_flow_link GROUP BY source_panel_code, target_panel_code
ORDER BY source_panel_code, target_panel_code;
GO
PRINT N'=== link_status 取值分布 ===';
SELECT link_status AS 状态, COUNT(*) AS 条数 FROM form_flow_link GROUP BY link_status;
GO
PRINT N'=== 批次台账(lot_trace) ===';
SELECT COUNT(*) AS 台账行数 FROM lot_trace;
GO
