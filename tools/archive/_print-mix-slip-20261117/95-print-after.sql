SET NOCOUNT ON;
SELECT id, 工单号, 工单行号, 领料类型, 领料单号, 状态, 创建时间 FROM wo_pick_doc
WHERE 工单号 = N'GD-2026-11-0008' ORDER BY id DESC;
GO
SELECT COUNT(*) AS 剩余打印任务 FROM yj_print_task;
