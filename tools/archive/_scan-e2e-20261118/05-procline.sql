SET NOCOUNT ON;
PRINT '--- A. 工序台账按状态 ---';
SELECT ISNULL(状态,N'') AS 状态, COUNT(*) AS 行数 FROM wo_process_line WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY ISNULL(状态,N'');
GO
PRINT '--- B. 未开工的工序台账(前 8) ---';
SELECT TOP 8 id, 工单号, 工单行id, 工序, 工序序, 计划数量, ISNULL(状态,N'') AS 状态 FROM wo_process_line
WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(状态,N'') <> N'已完成' ORDER BY 工单号 DESC, 工序序;
