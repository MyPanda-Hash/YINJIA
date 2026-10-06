/* migrate-plang-void-legacy-dirty.sql(2026-10-05):作废遗留异常工单行(计划量 16,019,480)
 *
 * 用户口径(2026-10-05):「遗留工单行可以作废」。
 * 背景:MO-2026-09-0136 的第 3 行(plang.id=92,建单 2026-09-28)计划量 = 16,019,480,而该工单其余 7 行
 *   合计仅 4,948 —— 该行让工单列表的「工序进度」、工序任务队列的未完成量、工序总览、工单详情汇总**全部失真**
 *   (详情页曾出现 完工合计 0 / 48074940 = 3 道工序各把全量算一遍的三重计算)。
 *
 * 处置:**软删**(asp_cancel='Y' + asp_user2/asp_time2 留痕),不做物理删除 ⇒ 可随时改回 'N' 撤回。
 *   撤回方式:UPDATE plang SET asp_cancel='N' WHERE pl_no=N'MO-2026-09-0136' AND ISNULL(pl_sl,0)>100000;
 * 幂等可重跑;两账套均执行。
 */
UPDATE plang SET asp_cancel = 'Y', asp_user2 = N'作废遗留异常行', asp_time2 = GETDATE()
 WHERE pl_no = N'MO-2026-09-0136' AND ISNULL(pl_sl, 0) > 100000 AND ISNULL(asp_cancel, 'N') <> 'Y';
GO
IF EXISTS (SELECT 1 FROM plang WHERE ISNULL(pl_sl,0) > 100000 AND ISNULL(asp_cancel,'N') <> 'Y')
  PRINT N'注意:仍存在计划量 > 10 万的未作废行,请复核';
ELSE PRINT N'遗留异常行已作废(软删,可改回 asp_cancel=N 撤回)';
GO