SET NOCOUNT ON;
SELECT TOP 20 id, 单据编号, 工序, 计划数量, 完成数量, 工单行id, 工序序, 生产线, 状态, 产品编码, 产品名称, ISNULL(asp_cancel,'') c
  FROM wo_progress ORDER BY id;
GO
SELECT COUNT(*) progress_rows, SUM(CASE WHEN ISNULL(asp_cancel,'N')<>'N' THEN 1 ELSE 0 END) canceled FROM wo_progress;
GO
SELECT name, definition FROM sys.sql_modules WHERE object_id = OBJECT_ID('v_wo_process_progress');
