SET NOCOUNT ON;

SELECT N'--- wo_process_line 样本 ---' AS x;
SELECT TOP 15 工单行id, 工序, 工序序, 计划数量, 计划生产线, 实际生产线, 状态, asp_cancel
FROM dbo.wo_process_line WHERE 工单行id IN (2171, 1147, 1170) AND ISNULL(asp_cancel,'N') <> 'Y'
ORDER BY 工单行id, 工序序;

SELECT N'--- 有台账的工单行数 ---' AS x;
SELECT COUNT(DISTINCT 工单行id) AS 行数, COUNT(*) AS 台账行 FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N') <> 'Y';

SELECT N'--- 附件(该面板)---' AS x;
SELECT COUNT(*) AS n FROM dbo.yj_attachment WHERE panel_code = 'PROC_FLOW_CARD';

SELECT N'--- plang_pc 列 ---' AS x;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = N'plang_pc' AND (COLUMN_NAME LIKE N'%批次%' OR COLUMN_NAME IN (N'id', N'plang_id', N'asp_cancel'));
