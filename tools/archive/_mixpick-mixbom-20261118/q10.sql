SET NOCOUNT ON;
PRINT '== wo_pick_doc(GD-2026-09-0135) ==';
SELECT id, 工单号, 工单行号, 领料类型, 状态, 领料单号, 物料项数, 已领项数 FROM dbo.wo_pick_doc WHERE 工单号=N'GD-2026-09-0135' ORDER BY id;
PRINT '== wo_pick_line(本次两张单) ==';
SELECT l.单头id, d.领料类型, l.行号, l.物料编码, l.物料名称, l.计量单位, l.需求数量, l.实领数量, l.明细备注
  FROM dbo.wo_pick_line l JOIN dbo.wo_pick_doc d ON d.id = l.单头id
 WHERE d.工单号=N'GD-2026-09-0135' ORDER BY l.单头id, l.行号;
