/* migrate-wo-next-process-view-nodefault.sql(2026-10-05):去掉"下一道工序"的默认路线兜底
 *
 * 用户口径:「当前存在默认选择工艺路线的问题,不需要实现默认选择」。
 *   此前 v_wo_next_process 把空路线当 GY-CB-STD,等于**替用户默认选了路线**;
 *   改为:**只有工单明确关联了工艺路线**才推导下一道工序(空路线 → 该单不出现在视图中,不猜)。
 * 撤回:重跑 migrate-wo-next-process-view.sql 即恢复带兜底的版本。幂等;两账套均执行。
 */
ALTER VIEW dbo.v_wo_next_process AS
SELECT p.pl_no AS 单号,
       p.[工艺路线] AS 工艺路线,
       r.工序名称 AS 下一道工序,
       ISNULL(r.生产车间, N'') AS 生产车间,
       ISNULL(r.加工顺序, 0) AS 工序序
  FROM dbo.plang p
  CROSS APPLY (SELECT TOP 1 r2.工序名称, r2.生产车间, r2.加工顺序
                 FROM dbo.bs_route r2
                WHERE r2.工艺路线编码 = p.[工艺路线]
                  AND ISNULL(r2.asp_cancel,'N') <> 'Y' AND ISNULL(r2.工序名称, N'') <> N''
                  AND NOT EXISTS (SELECT 1 FROM dbo.scjl s
                                   WHERE s.gldh = p.pl_no AND s.gxdm = r2.工序名称
                                     AND ISNULL(s.asp_cancel,'N') <> 'Y' AND ISNULL(s.wgzt,'N') = 'Y')
                ORDER BY ISNULL(r2.加工顺序, 999)) r
 WHERE ISNULL(p.asp_cancel,'N') <> 'Y' AND ISNULL(p.[工艺路线], N'') <> N''
 GROUP BY p.pl_no, p.[工艺路线], r.工序名称, r.生产车间, r.加工顺序;
GO
IF EXISTS (SELECT 1 FROM dbo.v_wo_next_process)
  SELECT 下一道工序, COUNT(*) AS 工单数 FROM dbo.v_wo_next_process GROUP BY 下一道工序;
ELSE PRINT N'暂无带工艺路线的未完工工单(空路线不再兜底推导)';
GO