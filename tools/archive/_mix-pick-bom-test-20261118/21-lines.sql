SET NOCOUNT ON;
SELECT d.id, d.工单号, d.工单行号, d.领料类型, d.领料单号, d.产品编号, d.产品名称, d.物料项数, d.已领项数, d.状态
FROM wo_pick_doc d WHERE d.工单号 = N'GD-2026-11-0010' AND d.工单行号 = 3;
GO
SELECT l.单头id, d.领料类型, l.行号, l.物料编码, l.物料名称, l.计量单位, l.需求数量, l.实领数量, l.仓库, l.明细备注
FROM wo_pick_line l JOIN wo_pick_doc d ON d.id = l.单头id
WHERE d.工单号 = N'GD-2026-11-0010' AND d.工单行号 = 3
ORDER BY d.领料类型 DESC, l.行号;
