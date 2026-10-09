/* migrate-wo-process-board-view.sql(2026-10-05):工序总览视图(按工序汇总工序任务)
 *
 * 用户口径:工单要能"点开看处在哪个阶段",并要一份工序维度的总览;所有新增物都要**可撤回**。
 * 本脚本只新增一个**只读视图**(不改任何表结构、不写任何业务数据):
 *   v_wo_process_board —— 按 工序/工艺(成型/切炭/组装) 汇总 wo_progress:
 *   任务数/待加工/在加工/已完工/计划量/完成量/未完成量/急单数/涉及产线/最早计划完工。
 * 撤回方式(整段可回滚,不留痕):DROP VIEW dbo.v_wo_process_board;  (无表结构变更、无数据变更)
 * 幂等可重跑;两账套均执行。
 */

IF OBJECT_ID(N'dbo.v_wo_process_board', N'V') IS NULL
  EXEC sp_executesql N'CREATE VIEW dbo.v_wo_process_board AS SELECT CAST(NULL AS nvarchar(50)) AS 工序';
GO
ALTER VIEW dbo.v_wo_process_board AS
SELECT ISNULL(生产车间, N'未分类') AS 工序,
       COUNT(*) AS 任务数,
       SUM(CASE WHEN 状态 = N'待加工' THEN 1 ELSE 0 END) AS 待加工数,
       SUM(CASE WHEN 状态 = N'在加工' THEN 1 ELSE 0 END) AS 在加工数,
       SUM(CASE WHEN 状态 = N'已完工' THEN 1 ELSE 0 END) AS 已完工数,
       SUM(ISNULL(计划数量, 0)) AS 计划量,
       SUM(ISNULL(完成数量, 0)) AS 完成量,
       SUM(ISNULL(计划数量, 0) - ISNULL(完成数量, 0)) AS 未完成量,
       SUM(CASE WHEN 优先级 = N'急单' THEN 1 ELSE 0 END) AS 急单数,
       COUNT(DISTINCT NULLIF(ISNULL(生产线, N''), N'')) AS 涉及产线,
       CONVERT(varchar(10), MIN(计划完工日期), 120) AS 最早计划完工
  FROM dbo.wo_progress
 WHERE ISNULL(asp_cancel, N'N') <> N'Y'
 GROUP BY 生产车间;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.v_wo_process_board') AND ep.minor_id = 0 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'工序总览(按 工序/工艺 汇总工序任务):待加工/在加工/已完工/未完成量/急单/涉及产线;只读视图,可 DROP 回滚',
       N'SCHEMA', N'dbo', N'VIEW', N'v_wo_process_board';
GO
IF NOT EXISTS (SELECT 1 FROM dbo.v_wo_process_board)
  PRINT N'工序总览视图就绪(当前无工序任务,视图为空)';
ELSE
  SELECT 工序, 任务数, 待加工数, 在加工数, 已完工数, 未完成量, 急单数, 涉及产线 FROM dbo.v_wo_process_board ORDER BY 工序;
GO