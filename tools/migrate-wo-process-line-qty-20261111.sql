/* ============================================================================
 * 工单工序台账「按量流转」对账重算（2026-11-11）
 *
 * 背景：2026-11-11 起工序之间改为**按上一道已审完工量流转**（用户口径：
 *   「第一个工序有500个计划完成量，那么当前我就应该有200个报工完成的数量后，
 *     第二个工序就能报工对应的200来源于上一道工序完成的报工数」）。
 *   口径唯一实现在后端 ProcessFlow（Java）；本脚本只是把**存量台账状态**按同一口径
 *   重算一次，让改版后第一次打开页面就显示正确（运行时每次报工/看板加载也会再算，幂等）。
 *
 * 口径（与 ProcessFlow 一致）：
 *   done(i)      = 该工单行该道**已审**报工量（scjl，wgzt='Y'，未作废；锚 gd_id→plang_pc.plang_id）
 *   rate(i)      = bs_route.换算率（空/≤0 按 1）
 *   doneBase(i)  = done(i) / rate(i)
 *   availBase(i) = 首道 ? pl_sl(排产数量) : doneBase(i-1)      ← 可加工量（成品口径）
 *   状态         = availBase ≤ 0 → 计划；doneBase ≥ pl_sl → 已完工；否则 已落实
 *
 * 副作用（与运行时同口径）：
 *   · 有流入（availBase > 0）时补「实际生产线」= 已有值优先，空则取「计划生产线」；
 *     「落实时间」空则补当前时间。
 *   · 无流入（应回「计划」）时清空「实际生产线 / 落实时间」。
 *
 * 幂等：只更新「状态与按量口径不一致」或「需要补/清线」的行，重复执行 0 行受影响。
 * 零 DDL：不建表、不改列、不动面板；只写 wo_process_line 的 状态/实际生产线/落实时间。
 * 两账套都要执行（先正式 HSDZ_MES、后测试 HSDZ_MES_TEST），末尾自检不符即报错。
 * ========================================================================== */

SET NOCOUNT ON;

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
                      AND EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = o.pid)), 0) AS done
    FROM ops o
),
chain AS (
    SELECT c.*, c.done / c.rate AS donebase,
           CASE WHEN c.seq = (SELECT MIN(c2.seq) FROM calc c2 WHERE c2.pid = c.pid) THEN c.pl_sl
                ELSE (SELECT TOP 1 c3.done / c3.rate FROM calc c3
                       WHERE c3.pid = c.pid AND c3.seq < c.seq ORDER BY c3.seq DESC) END AS availbase
    FROM calc c
),
want AS (
    SELECT c.pl_no, c.pid, c.op, c.donebase, c.availbase, c.pl_sl,
           CASE WHEN ISNULL(c.availbase, 0) <= 0.0001 THEN N'计划'
                WHEN c.donebase + 0.0001 >= c.pl_sl THEN N'已完工'
                ELSE N'已落实' END AS st
    FROM chain c
)
UPDATE w
   SET w.状态 = x.st,
       w.实际生产线 = CASE WHEN x.st = N'计划' THEN NULL
                          ELSE COALESCE(NULLIF(w.实际生产线, N''), NULLIF(w.计划生产线, N'')) END,
       w.落实时间   = CASE WHEN x.st = N'计划' THEN NULL
                          ELSE COALESCE(w.落实时间, SYSDATETIME()) END,
       w.asp_user2  = N'migrate-qty-flow-20261111',
       w.asp_time2  = SYSDATETIME()
FROM dbo.wo_process_line w
JOIN want x
  ON x.pl_no = w.工单号 AND x.op = w.工序 AND (w.工单行id = x.pid OR w.工单行id IS NULL)
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y'
  AND ( ISNULL(w.状态, N'') <> x.st
     OR (x.st <> N'计划' AND (NULLIF(w.实际生产线, N'') IS NULL OR w.落实时间 IS NULL))
     OR (x.st =  N'计划' AND (w.实际生产线 IS NOT NULL OR w.落实时间 IS NOT NULL)) );

PRINT 'qty-flow recalc: 台账状态已按量流转口径重算完成';

/* ── 自检:重算后「状态」必须与按量口径完全一致(不一致数应为 0) ─────────────── */
DECLARE @drift INT = 0;
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
                      AND EXISTS (SELECT 1 FROM dbo.plang_pc pc WHERE pc.id = s.gd_id AND pc.plang_id = o.pid)), 0) AS done
    FROM ops o
),
chain AS (
    SELECT c.*, c.done / c.rate AS donebase,
           CASE WHEN c.seq = (SELECT MIN(c2.seq) FROM calc c2 WHERE c2.pid = c.pid) THEN c.pl_sl
                ELSE (SELECT TOP 1 c3.done / c3.rate FROM calc c3
                       WHERE c3.pid = c.pid AND c3.seq < c.seq ORDER BY c3.seq DESC) END AS availbase
    FROM calc c
),
want AS (
    SELECT c.pl_no, c.pid, c.op, c.donebase, c.availbase, c.pl_sl,
           CASE WHEN ISNULL(c.availbase, 0) <= 0.0001 THEN N'计划'
                WHEN c.donebase + 0.0001 >= c.pl_sl THEN N'已完工'
                ELSE N'已落实' END AS st
    FROM chain c
)
SELECT @drift = COUNT(*)
FROM dbo.wo_process_line w
JOIN want x ON x.pl_no = w.工单号 AND x.op = w.工序 AND (w.工单行id = x.pid OR w.工单行id IS NULL)
WHERE ISNULL(w.asp_cancel, 'N') <> 'Y' AND ISNULL(w.状态, N'') <> x.st;

IF @drift > 0
    RAISERROR(N'migrate-wo-process-line-qty-20261111: 重算后仍有 %d 行台账状态与按量口径不一致', 16, 1, @drift);
ELSE
    PRINT 'qty-flow recalc self-check: 0 行不一致';
