SET NOCOUNT ON;
-- 视图定义
SELECT OBJECT_NAME(object_id) v, definition FROM sys.sql_modules WHERE object_id IN (OBJECT_ID('v_wo_process_progress'), OBJECT_ID('v_wo_next_process'));
GO
SELECT c.name, t.name typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('wo_process_line') ORDER BY c.column_id;
GO
SELECT c.name, t.name typ FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id
 WHERE c.object_id=OBJECT_ID('bl_other_in') ORDER BY c.column_id;
GO
SELECT TOP 20 * FROM wo_progress;
GO
-- 有工序数据的工单
SELECT TOP 20 工单号, 工单行号, 工序, 计划数量, 完成数量 FROM v_wo_process_progress;
