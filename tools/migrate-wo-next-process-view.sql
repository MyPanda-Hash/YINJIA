/* migrate-wo-next-process-view.sql(2026-10-05):工单「下一道工序」视图(排产/调拨/详情**共用一处口径**)
 *
 * 用户口径:订单结转选定工艺路线后,各环节要知道"这张单**现在该做哪道工序**"(据此收敛候选产线)。
 *   定义:下一道工序 = 该工单路线里**第一个尚无已审核报工**的工序(全部做完 → 取末道);未绑路线时按 GY-CB-STD。
 *   为什么做成视图:此前"产线口径"在排产与调拨各写一套,导致分叉(2026-10-05 教训)⇒ 统一由本视图提供。
 * 撤回:DROP VIEW dbo.v_wo_next_process;  幂等;两账套均执行。
 */
IF OBJECT_ID(N'dbo.v_wo_next_process', N'V') IS NULL
  EXEC sp_executesql N'CREATE VIEW dbo.v_wo_next_process AS SELECT CAST(NULL AS nvarchar(50)) AS 单号, CAST(NULL AS nvarchar(50)) AS 工艺路线, CAST(NULL AS nvarchar(50)) AS 下一道工序, CAST(NULL AS nvarchar(50)) AS 生产车间, CAST(NULL AS int) AS 工序序';
GO
ALTER VIEW dbo.v_wo_next_process AS
SELECT p.pl_no AS 单号,
       ISNULL(NULLIF(p.[工艺路线], N''), N'GY-CB-STD') AS 工艺路线,
       r.工序名称 AS 下一道工序,
       ISNULL(r.生产车间, N'') AS 生产车间,
       ISNULL(r.加工顺序, 0) AS 工序序
  FROM dbo.plang p
  CROSS APPLY (SELECT TOP 1 r2.工序名称, r2.生产车间, r2.加工顺序
                 FROM dbo.bs_route r2
                WHERE r2.工艺路线编码 = ISNULL(NULLIF(p.[工艺路线], N''), N'GY-CB-STD')
                  AND ISNULL(r2.asp_cancel,'N') <> 'Y' AND ISNULL(r2.工序名称, N'') <> N''
                  AND NOT EXISTS (SELECT 1 FROM dbo.scjl s
                                   WHERE s.gldh = p.pl_no AND s.gxdm = r2.工序名称
                                     AND ISNULL(s.asp_cancel,'N') <> 'Y' AND ISNULL(s.wgzt,'N') = 'Y')
                ORDER BY ISNULL(r2.加工顺序, 999)) r
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y'
 GROUP BY p.pl_no, p.[工艺路线], r.工序名称, r.生产车间, r.加工顺序;
GO
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
               WHERE ep.major_id = OBJECT_ID(N'dbo.v_wo_next_process') AND ep.minor_id = 0 AND ep.name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'工单下一道工序(按工单工艺路线+已审核报工推导;排产/调拨/工单详情共用口径);只读视图,可 DROP 回滚',
       N'SCHEMA', N'dbo', N'VIEW', N'v_wo_next_process';
GO
IF EXISTS (SELECT 1 FROM dbo.v_wo_next_process)
  SELECT 下一道工序, COUNT(*) AS 工单数 FROM dbo.v_wo_next_process GROUP BY 下一道工序 ORDER BY 工单数 DESC;
ELSE PRINT N'下一道工序视图就绪(当前无可推导工单)';
GO