SELECT TOP 20 id, 单据编号, 工序, 工序序, 状态, 计划数量, 完成数量, 生产线, 生产车间, ISNULL(asp_cancel,'N') AS c
FROM dbo.wo_progress ORDER BY id DESC;
SELECT COUNT(*) AS wo_progress_rows FROM dbo.wo_progress;
