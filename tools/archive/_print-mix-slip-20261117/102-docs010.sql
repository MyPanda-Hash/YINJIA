SET NOCOUNT ON;
SELECT id, 工单号, 工单行号, 领料类型, 领料单号, 状态 FROM wo_pick_doc WHERE 工单号 = N'GD-2026-11-0010' ORDER BY id DESC;
