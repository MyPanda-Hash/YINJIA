SET NOCOUNT ON;
SELECT d.id, d.工单号, d.工单行号, d.领料类型, d.领料单号, d.状态, d.创建时间 FROM wo_pick_doc d
WHERE d.创建时间 > CONVERT(datetime, '2026-11-17 15:50:00', 120) ORDER BY d.id;
