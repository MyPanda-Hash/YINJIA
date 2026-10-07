/* migrate-wo-process-line-qty-recalc.sql(2026-10-07):按新口径校正预排台账的「计划数量」
 *
 * 背景(用户口径 2026-10-07):「后面的计划数量比例不该顺延下去,应该各个工序的换算率**分开算**」
 *   + 「同一工单不同行号,完成对应排产数量的报工后应进入下一个产线」。
 *   旧口径 = 逐道累乘(成型7 → 切炭7×1 → …)、且基数曾用整单合计 ⇒ 台账里已存的值偏大,
 *   导致转序判据(该道已审报工量 ≥ 台账计划数量)虚高,**完成报工也不转序**。
 *
 * 新口径:计划数量 = **所排工单行的排产数量 × 该工序自己的换算率**(各道独立,不累乘)。
 *   本脚本把**已存在的台账行**(未作废)按新口径重算一遍;幂等可重跑。
 *   回滚:无需回滚(值变正确);如需复现旧值,见 git 历史。
 * 两账套均执行。
 */
SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.wo_process_line', N'U') IS NOT NULL
BEGIN
    UPDATE w
       SET w.计划数量 = CAST(
             ISNULL((
               /* 基数 = 台账指定工单行的排产数量;没指定时取该工单首行 */
               SELECT TOP 1 ISNULL(p.pl_sl, 0)
                 FROM dbo.plang p
                WHERE p.pl_no = w.工单号 AND ISNULL(p.asp_cancel,'N') <> 'Y'
                  AND (w.工单行id IS NULL OR p.id = w.工单行id)
                ORDER BY p.id
             ), 0)
             * ISNULL((
               /* 该工序自己的换算率(该行工艺路线下;查不到=1) */
               SELECT TOP 1 ISNULL(r.换算率, 1)
                 FROM dbo.bs_route r
                WHERE r.工艺路线编码 = ISNULL((
                        SELECT TOP 1 ISNULL(p2.[工艺路线], N'')
                          FROM dbo.plang p2
                         WHERE p2.pl_no = w.工单号 AND ISNULL(p2.asp_cancel,'N') <> 'Y'
                           AND (w.工单行id IS NULL OR p2.id = w.工单行id)
                         ORDER BY p2.id), N'')
                  AND r.工序名称 = w.工序 AND ISNULL(r.asp_cancel,'N') <> 'Y'
             ), 1) AS decimal(18,4)),
           w.asp_user2 = 'qty-recalc', w.asp_time2 = GETDATE()
      FROM dbo.wo_process_line w
     WHERE ISNULL(w.asp_cancel,'N') <> 'Y';

    IF EXISTS (SELECT 1 FROM dbo.wo_process_line WHERE ISNULL(计划数量,0) < 0)
      RAISERROR(N'预排台账计划数量校正出现负值,请检查', 16, 1);
    ELSE PRINT N'预排台账计划数量已按「本行排产数量 × 本工序换算率」校正(各道分开算,不累乘)';
END
ELSE PRINT N'预排台账不存在(跳过)';
GO

SELECT 工单号, 工序序, 工序, ISNULL(计划数量,0) AS 计划数量, ISNULL(计划生产线,N'') AS 计划线, ISNULL(状态,N'') AS 状态
FROM dbo.wo_process_line WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY 工单号, 工序序;
GO
