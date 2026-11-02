SET NOCOUNT ON;
SELECT LEFT(工单号,8) 组, 状态, COUNT(*) n FROM wo_pick_doc WHERE 工单号 LIKE 'GD-STG-%' GROUP BY LEFT(工单号,8), 状态;
GO
SELECT 工单号, 领料单号, 状态, ISNULL(退料单号,'') 退料单号, 已领项数, 物料项数 FROM wo_pick_doc WHERE 工单号 LIKE 'GD-STG-F%' ORDER BY 工单号;
GO
SELECT 领料单号, COUNT(*) 笔数, SUM(退料数量) 退料合计 FROM wo_pick_return WHERE 领料单号 IN (SELECT 领料单号 FROM wo_pick_doc WHERE 工单号 LIKE 'GD-STG-F%') GROUP BY 领料单号;
