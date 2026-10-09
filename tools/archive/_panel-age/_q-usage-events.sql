SET NOCOUNT ON;
SELECT panel_name, event_type, action_name, COUNT(*) AS n FROM dbo.yj_usage_log
WHERE panel_name IN (N'库存台账', N'库存状况表', N'采购入库单', N'生产工单')
GROUP BY panel_name, event_type, action_name ORDER BY panel_name, n DESC;
