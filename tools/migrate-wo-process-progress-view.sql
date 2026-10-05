/* migrate-wo-process-progress-view.sql(2026-10-05):工单工序进度视图 —— 「当前工序 / 工序进度」派生口径
 *
 * 背景(用户问「当前如何区分组装单还是成型单」):本厂**工单贯穿制**(一张单依次过混料→成型→切炭→组装→装箱),
 *   plang 上没有工序列、也不该有 —— 工单的"工序"只存在于**报工**(scjl.gxdm)。所以"这单是成型还是组装"
 *   实际要回答的是「**这张单现在走到哪道工序了**」。本视图一次算好,供工单列表/排产页/后续报表共用。
 *
 * 口径:
 *   · 工序标准顺序 = 混料(1)→成型(2)→切炭(3)→组装(4)→装箱(5)(与 bs_op 五工序档案、看板口径一致);
 *   · 只算**已完工报工行**(wgzt='Y' 且未作废),按 工单号 × 工序 汇总完成量;
 *   · 当前工序 = 有完工量的**最大工序序号**;完工合计 = 全工序完成量之和。
 * 幂等(CREATE OR ALTER);两账套均执行。
 */

IF OBJECT_ID(N'dbo.v_wo_process_progress', N'V') IS NULL
  EXEC sp_executesql N'CREATE VIEW dbo.v_wo_process_progress AS SELECT CAST(NULL AS nvarchar(50)) AS 单号, CAST(NULL AS nvarchar(50)) AS 当前工序, CAST(NULL AS int) AS 当前工序序, CAST(NULL AS decimal(18,4)) AS 当前工序完工量, CAST(NULL AS decimal(18,4)) AS 完工合计';
GO

ALTER VIEW dbo.v_wo_process_progress AS
WITH per AS (
  SELECT s.gldh AS 单号,
         CASE s.gxdm WHEN N'混料' THEN 1 WHEN N'成型' THEN 2 WHEN N'切炭' THEN 3
                     WHEN N'组装' THEN 4 WHEN N'装箱' THEN 5 ELSE 0 END AS 工序序,
         SUM(ISNULL(s.sl, 0)) AS 完工量
    FROM dbo.scjl s
   WHERE ISNULL(s.asp_cancel, 'N') <> 'Y'
     AND ISNULL(s.wgzt, 'N') = 'Y'
     AND ISNULL(s.gldh, N'') <> N''
     AND s.gxdm IS NOT NULL
   GROUP BY s.gldh,
         CASE s.gxdm WHEN N'混料' THEN 1 WHEN N'成型' THEN 2 WHEN N'切炭' THEN 3
                     WHEN N'组装' THEN 4 WHEN N'装箱' THEN 5 ELSE 0 END
)
SELECT p.单号,
       CASE p.工序序 WHEN 1 THEN N'混料' WHEN 2 THEN N'成型' WHEN 3 THEN N'切炭'
                     WHEN 4 THEN N'组装' WHEN 5 THEN N'装箱' ELSE N'' END AS 当前工序,
       p.工序序 AS 当前工序序,
       p.完工量 AS 当前工序完工量,
       (SELECT ISNULL(SUM(x.完工量), 0) FROM per x WHERE x.单号 = p.单号) AS 完工合计
  FROM per p
 WHERE p.工序序 > 0
   AND p.工序序 = (SELECT MAX(y.工序序) FROM per y WHERE y.单号 = p.单号);
GO

/* 中文注明(视图也纳入全量部署规范) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.v_wo_process_progress') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'工单工序进度(派生):当前工序=已完工报工里最靠后的一道(混料→成型→切炭→组装→装箱)',
       N'SCHEMA', N'dbo', N'VIEW', N'v_wo_process_progress';
GO

/* 自检 */
IF OBJECT_ID(N'dbo.v_wo_process_progress', N'V') IS NULL
  RAISERROR(N'v_wo_process_progress 未建成', 16, 1);
ELSE IF COL_LENGTH(N'dbo.v_wo_process_progress', N'当前工序') IS NULL
  RAISERROR(N'v_wo_process_progress 结构不对(缺 当前工序 列)', 16, 1);
ELSE IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID(N'dbo.v_wo_process_progress') AND minor_id = 0 AND name = N'MS_Description')
  RAISERROR(N'v_wo_process_progress 缺中文注明', 16, 1);
ELSE PRINT N'工单工序进度视图就绪(v_wo_process_progress)';
GO
