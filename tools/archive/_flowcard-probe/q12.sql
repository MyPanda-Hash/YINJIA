SET NOCOUNT ON;
PRINT '--- wo_progress sample ---';
SELECT TOP 8 单据编号, 工序, 计划数量, 完成数量, 工单行id, 批次号, 工序序, 状态, 生产线 FROM wo_progress ORDER BY id DESC;
PRINT '--- wo_progress count by 状态 ---';
SELECT 状态, COUNT(*) n FROM wo_progress GROUP BY 状态;
PRINT '--- wo_process_line count ---';
SELECT COUNT(*) n FROM wo_process_line;
PRINT '--- wo_process_line sample ---';
SELECT TOP 8 * FROM wo_process_line ORDER BY id DESC;
