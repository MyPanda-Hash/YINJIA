/* ============================================================================
 * migrate-wo-ledger-rowid-align-20261112.sql
 *   工单工序台账「按工单行id 收口」+ 存量台账对账重算(零 DDL / 幂等 / 两账套)
 *
 * 【背景(2026-11-12 用户报障)】
 *   工单排产看板「后道可见(本线工序任务)」里出现一条**早已生产完工**的活:
 *   GD-2026-09-0049 行5(plang.id=123,pl_sl=rk_sl=996,完工状态=生产完工),
 *   在 装箱2(新厂) 被挂成「组装 421 / 已报 996」的待做任务,顶部合计被顶高、左栏却是 0。
 *
 *   根因:台账唯一权威键应是 **工单行id**(2026-10-15 用户口径「工单号+工单行号确定当前唯一工单」),
 *   但 2026-10-10「行级锚定」修好之前建的历史台账行把 **工单号存错了**:
 *     wo_process_line id=16/17/18 → 工单行id=123(GD-2026-09-0049 行5)却存 工单号=GD-2026-10-0003;
 *     wo_process_line id=13/14/15 → 工单行id=119(GD-2026-09-0049 行1)却存 工单号=GD-2026-10-0002。
 *   而此前后端/迁移一律按 `工单号=?` 找台账(ProcessFlow.ledgerPlanQty、ProcessTaskService.applyNextProcess、
 *   上一版对账脚本 migrate-wo-process-line-qty-20261111.sql)⇒ 这几行永远匹配不上,状态被永久冻在
 *   「已落实」,看板于是把已完工的行当成"等我装箱的活"。
 *
 * 【本脚本做的事(只写 wo_process_line 的 工单号/状态/实际生产线/落实时间,零 DDL)】
 *   ① 工单号 回正:按 工单行id JOIN plang,把冗余列 工单号 刷成 plang.pl_no
 *      —— 台账读到哪一行只认 工单行id;工单号 从此与之一致,历史遗留的"号/行对不上"清零;
 *   ② 状态重算:与后端 ProcessFlow 同一口径(pl_sl / bs_route.换算率 / 该道**已审**报工量,
 *      报工行锚定 scjl.gd_id → plang_pc.plang_id),按 **工单行id** 逐行重算整行台账的
 *      状态 / 实际生产线 / 落实时间;
 *   ③ 自检(不过就 RAISERROR 中止,DbSync 判 FAIL 且不写 yj_schema_log,迁移链不静默越过):
 *      「工单号漂移」(台账 工单号 ≠ 该行 plang.pl_no)= 0 行;
 *      「状态漂移」(台账 状态 ≠ 按量口径算出的状态)      = 0 行。
 *
 * 【重算口径(与 ProcessFlow.steps 完全一致:先把量折成品再比)】
 *   done(i)    该工单行该道已审报工量(scjl:未作废 且 wgzt='Y',锚 gd_id → plang_pc.plang_id)
 *   rate(i)    bs_route.换算率(空/≤0 按 1)
 *   doneBase   done / rate
 *   availBase  首道 ? plang.pl_sl : 上一道 doneBase      ← 可加工量(成品口径)= 前道流下来的量
 *   状态        availBase ≤ 0    → 计划    (没有量流下来)
 *              doneBase ≥ pl_sl  → 已完工  (折成品做满,与 ProcessFlow.Step.full 判据同值)
 *              否则              → 已落实  (有流入、未做满)
 *   实际生产线  非「计划」保留已有值,空则取「计划生产线」;回「计划」则清空
 *              (运行时 applyNextProcess 同口径;"计划线为空/车间配不上 ⇒ 请人工派线"仍由运行时提示,脚本不猜线)
 *   落实时间    非「计划」保留已有值,空则取**上一道已审完工时间**(scjl.wgsj 最大值),仍取不到才用
 *              SYSDATETIME();回「计划」则清空
 *              (与 ProcessTaskService.reportedDoneTime + applyNextProcess 同语义:
 *               2026-10-29 口径「实际开工 = 上一道实际完工时间」)
 *
 * 【只统计、不修改的行(没有权威行可锚,重算无从谈起;留给人工/后续任务)】
 *   · 工单行id 指向的 plang 行已不存在 —— 实测 6 行(工单号=GD-2026-10-0007,该单仅剩的 plang 行已作废);
 *   · 工单行id 指向的 plang 行已作废 —— 实测 21 行(作废工单的台账不参与看板/报工);
 *   · 台账工序不在该行工艺路线上 —— 实测 0 行(重算取不到它在路线上的位置);
 *   · 工单行id 为空的老数据 —— 实测 0 行(这些行走 ProcessFlow 的"按工单号"兜底读,不在此重算)。
 *   这些行**不会让自检失败**,但末尾用一行 [print] 报出行数,便于复核。
 *
 * 【幂等】
 *   只更新"与该口径不一致"的行;落实时间取的是不变量(上一道已审完工时间),不会每次刷成 now;
 *   实际生产线只在"能补"时(计划线非空)才触发更新 ⇒ 第二次执行 0 行受影响(两账套均验证过)。
 *
 * 【两账套】先正式 HSDZ_MES、后测试 HSDZ_MES_TEST。测试库是旧快照(台账 21 行、无号/行不一致),
 *   本脚本在其上为 0 行变更,只做迁移链登记。
 * ========================================================================== */

SET NOCOUNT ON;

DECLARE @stamp  nvarchar(60) = N'migrate-ledger-rowid-align-20261112';
DECLARE @fixNo  int = 0, @recalc int = 0;
DECLARE @driftNo int = 0, @driftSt int = 0, @unjudge int = 0, @dangling int = 0, @noLine int = 0, @other int = 0;

/* ── ① 工单号 回正:台账的行锚点是 工单行id,工单号 只是冗余列 ──────────────── */
UPDATE w
   SET w.工单号   = p.pl_no,
       w.asp_user2 = @stamp,
       w.asp_time2 = SYSDATETIME()
FROM dbo.wo_process_line w
JOIN dbo.plang p ON p.id = w.工单行id
WHERE w.工单行id IS NOT NULL
  AND ISNULL(w.工单号, N'') <> ISNULL(p.pl_no, N'');
SET @fixNo = @@ROWCOUNT;

/* ── ② 按 工单行id 重算整行台账(与 ProcessFlow 同一口径) ─────────────────── */
/* 口径只算一次、落到 #want:重算与自检共用同一份,杜绝"两段 SQL 各写一套公式"的口径漂移。
   rn = 同名工序去重(路线里万一有两道同名工序,取工序序最前那条,与 ledgerPlanQty 的取法一致)。 */
IF OBJECT_ID(N'tempdb..#want') IS NOT NULL DROP TABLE #want;

;WITH ops AS (
    SELECT p.id AS pid, p.pl_no, ISNULL(p.pl_sl, 0) AS pl_sl,
           rt.工序名称 AS op, ISNULL(rt.加工顺序, 999) AS seq,
           CASE WHEN ISNULL(rt.换算率, 0) <= 0 THEN 1 ELSE rt.换算率 END AS rate
    FROM dbo.plang p
    JOIN dbo.bs_route rt
      ON rt.工艺路线编码 = ISNULL(p.[工艺路线], N'')
     AND ISNULL(rt.asp_cancel, 'N') <> 'Y'
     AND ISNULL(rt.工序名称, N'') <> N''
    WHERE ISNULL(p.asp_cancel, 'N') <> 'Y'
),
calc AS (
    SELECT o.*,
           ISNULL((SELECT SUM(ISNULL(s.sl, 0)) FROM dbo.scjl s
                    WHERE s.gldh = o.pl_no AND s.gxdm = o.op
                      AND ISNULL(s.asp_cancel, 'N') <> 'Y' AND ISNULL(s.wgzt, 'N') = 'Y'
                      AND EXISTS (SELECT 1 FROM dbo.plang_pc pc
                                   WHERE pc.id = s.gd_id AND pc.plang_id = o.pid)), 0) AS done
    FROM ops o
),
chain AS (
    SELECT c.*, c.done / c.rate AS donebase,
           CASE WHEN c.seq = (SELECT MIN(c2.seq) FROM calc c2 WHERE c2.pid = c.pid) THEN c.pl_sl
                ELSE (SELECT TOP 1 c3.done / c3.rate FROM calc c3
                       WHERE c3.pid = c.pid AND c3.seq < c.seq ORDER BY c3.seq DESC) END AS availbase,
           (SELECT TOP 1 c4.op FROM calc c4
             WHERE c4.pid = c.pid AND c4.seq < c.seq ORDER BY c4.seq DESC) AS prevop,
           ROW_NUMBER() OVER (PARTITION BY c.pid, c.op ORDER BY c.seq, c.rate) AS rn
    FROM calc c
),
want AS (
    SELECT c.pid, c.op, c.rn,
           CASE WHEN ISNULL(c.availbase, 0) <= 0.0001 THEN N'计划'
                WHEN c.donebase + 0.0001 >= c.pl_sl      THEN N'已完工'
                ELSE N'已落实' END AS st,
           -- 落实时间兜底 = 上一道**已审**报工的最大完工时间(首道/该道还没报工时为空 ⇒ 回落 SYSDATETIME)
           CASE WHEN ISNULL(c.availbase, 0) <= 0.0001 OR c.prevop IS NULL THEN NULL
                ELSE (SELECT MAX(s.wgsj) FROM dbo.scjl s
                       WHERE s.gldh = c.pl_no AND ISNULL(s.gxdm, N'') = c.prevop
                         AND ISNULL(s.asp_cancel, 'N') <> 'Y' AND ISNULL(s.wgzt, 'N') = 'Y'
                         AND EXISTS (SELECT 1 FROM dbo.plang_pc pc
                                      WHERE pc.id = s.gd_id AND pc.plang_id = c.pid)) END AS prevdone
    FROM chain c
)
SELECT x.pid, x.op, x.st, x.prevdone, x.rn INTO #want FROM want x;

UPDATE w
   SET w.状态       = x.st,
       w.实际生产线 = CASE WHEN x.st = N'计划' THEN NULL
                          ELSE COALESCE(NULLIF(w.实际生产线, N''), NULLIF(w.计划生产线, N'')) END,
       w.落实时间   = CASE WHEN x.st = N'计划' THEN NULL
                          ELSE COALESCE(w.落实时间, x.prevdone, SYSDATETIME()) END,
       w.asp_user2  = @stamp,
       w.asp_time2  = SYSDATETIME()
FROM dbo.wo_process_line w
JOIN #want x ON x.pid = w.工单行id AND x.op = w.工序 AND x.rn = 1
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y'
  AND ( ISNULL(w.状态, N'') <> x.st
     OR (x.st <> N'计划'
         AND ((NULLIF(w.实际生产线, N'') IS NULL AND NULLIF(w.计划生产线, N'') IS NOT NULL)
              OR w.落实时间 IS NULL))
     OR (x.st =  N'计划' AND (w.实际生产线 IS NOT NULL OR w.落实时间 IS NOT NULL)) );
SET @recalc = @@ROWCOUNT;

/* ── ③ 自检:按 工单行id 口径的漂移必须都是 0 ─────────────────────────────── */
SELECT @driftNo = COUNT(*)
FROM dbo.wo_process_line w
JOIN dbo.plang p ON p.id = w.工单行id
WHERE ISNULL(w.工单号, N'') <> ISNULL(p.pl_no, N'');

SELECT @driftSt = COUNT(*)
FROM dbo.wo_process_line w
JOIN #want x ON x.pid = w.工单行id AND x.op = w.工序 AND x.rn = 1
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y' AND ISNULL(w.状态, N'') <> x.st;

SELECT @dangling = COUNT(*)
FROM dbo.wo_process_line w
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y' AND w.工单行id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.id = w.工单行id);

SELECT @unjudge = COUNT(*)
FROM dbo.wo_process_line w
LEFT JOIN #want x ON x.pid = w.工单行id AND x.op = w.工序 AND x.rn = 1
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y' AND x.pid IS NULL;

-- 非「计划」但补不出实际线(计划线也为空)⇒ 运行时会给"请人工派线"提示,脚本不猜线
SELECT @noLine = COUNT(*)
FROM dbo.wo_process_line w
JOIN #want x ON x.pid = w.工单行id AND x.op = w.工序 AND x.rn = 1
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y' AND x.st <> N'计划'
  AND ISNULL(w.实际生产线, N'') = N'' AND ISNULL(w.计划生产线, N'') = N'';

RAISERROR(N'rowid-align ① 工单号回正(工单行id → plang.pl_no):%d 行;② 按工单行id 重算台账:%d 行', 10, 1, @fixNo, @recalc);
-- ⚠ RAISERROR 的替换参数只能是变量/常量,不能写表达式 ⇒ 先算好 @other 再传
SET @other = @unjudge - @dangling;
RAISERROR(N'rowid-align ③ 自检:工单号漂移 %d 行 / 状态漂移 %d 行 / 不可判定 %d 行(悬空工单行id %d + 其余 %d:作废工单·工序不在路线)', 10, 1, @driftNo, @driftSt, @unjudge, @dangling, @other);
RAISERROR(N'rowid-align 补充:非计划行仍无实际生产线(计划线为空,需人工派线)%d 行', 10, 1, @noLine);

DROP TABLE #want;

IF @driftNo > 0 OR @driftSt > 0
    RAISERROR(N'migrate-wo-ledger-rowid-align-20261112: 按工单行id 收口后台账仍有漂移(工单号 %d 行 / 状态 %d 行),已中止', 16, 1, @driftNo, @driftSt);
ELSE
    RAISERROR(N'rowid-align self-check PASS:工单号漂移 0 行 / 状态漂移 0 行', 10, 1);
