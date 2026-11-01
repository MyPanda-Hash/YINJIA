/* ============================================================
   migrate-scjl-report-date-20261101.sql
   报工单「单据日期」补默认(存量修数):scjl.sc_date 为空 → 取完工时刻/录入时刻那天
   ============================================================

   用户报障(2026-11-01):
     「我报工了这一条为什么没有显示当前日期的实际报工数量」
     —— 工单排产页 11-01 列只有计划量 2(深色),没有「实际报工」的绿色值。

   根因:
     报工单的「单据日期」没人填 ⇒ scjl.sc_date = NULL;而排产看板/生产工单的**日期列**是按
     sc_date 把「已审核报工」分到当天的(WorkOrderDayPlanService.actualByDate)⇒ 已审核的报工
     在日期格上整条查不到(实测 BG-2026-11-0001:wgsj=2026-11-01、wgzt=Y、sc_date=NULL)。

   处置:
     ① 存量:sc_date 为空的行,按 COALESCE(wgsj, asp_time1) 的日期补上(只补空值,已有日期不动);
     ② 增量:代码侧 WoReportService.stampDocDate 在**保存/提交审批/审核**时补当天(仅空值),
        排产看板取数同时按 COALESCE(sc_date, wgsj, asp_time1) 兜底。

   幂等(重跑 0 行改动);两个账套都要执行。
   ============================================================ */
SET NOCOUNT ON;

DECLARE @bad int = (SELECT COUNT(*) FROM dbo.scjl
                    WHERE sc_date IS NULL AND ISNULL(asp_cancel, 'N') <> 'Y'
                      AND COALESCE(wgsj, asp_time1) IS NOT NULL);
PRINT N'[修数] 待补单据日期(sc_date 为空): ' + CAST(@bad AS nvarchar(10)) + N' 行';

UPDATE dbo.scjl
SET sc_date = CAST(CAST(COALESCE(wgsj, asp_time1) AS date) AS datetime)
WHERE sc_date IS NULL AND ISNULL(asp_cancel, 'N') <> 'Y'
  AND COALESCE(wgsj, asp_time1) IS NOT NULL;
PRINT N'[修数] 实补: ' + CAST(@@ROWCOUNT AS nvarchar(10)) + N' 行';

/* 自检:还有「有完工/录入时间却仍无单据日期」的行 = 失败 */
DECLARE @left int = (SELECT COUNT(*) FROM dbo.scjl
                     WHERE sc_date IS NULL AND ISNULL(asp_cancel, 'N') <> 'Y'
                       AND COALESCE(wgsj, asp_time1) IS NOT NULL);
IF @left > 0 RAISERROR(N'[FAIL] 仍有 %d 行报工单缺单据日期', 16, 1, @left);

PRINT N'[OK] 报工单单据日期已补齐(仅补空值)';
