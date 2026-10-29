/* ============================================================================
   migrate-finish-in-wo-backfill-20261022.sql
   产成品入库单（FINISH_IN）「加工单号」补齐 —— **只填空值、只填能说通的**

   用户口径（2026-10-22）：「写个脚本可以补齐成产品入库的加工单号。按照有的补齐。要合理，符合时间。」

   ── 一、这一列到底是什么 ────────────────────────────────────────────────
   加工单号 = **生产工单号 plang.pl_no**（不是金蝶的号）。现役代码三处同口径：
     · WorkOrderPickingService：`加工单号 = 工单号` + `工单行号 = plang.pl_xc`；
     · ButtonService 出单时 `head.put("加工单号", wo)`（wo = 工单号）；
     · 工单追溯 / 工单结案 / 工单拆分一律按 `bd_finish_in.加工单号 (+ 工单行号)` 反查工单。
   ⇒ 所以只能填**库里真实存在的 plang.pl_no**，编一个号会让追溯查到空气。

   ── 二、怎么判"合理、符合时间" ──────────────────────────────────────────
   对每张 `加工单号` 为空的产成品入库单：
     ① 候选工单 = plang 里"**含本单产品**"的工单号（bl_finish_in.产品编码 = plang.dm，去首尾空格）；
     ② 时间闸门 = 该工单的**最晚一行工单日期 ≤ 入库单日期**（工单不可能晚于入库），
        且距今 ≤ @MaxDays 天（默认 180）——工单比入库还晚、或隔着大半年的，不算合理；
     ③ 一张单只能落一个工单号 ⇒ 排序取第一条：
        覆盖产品数 desc → 时间差 asc（离得最近）→ 数量差 asc → 单号 desc；
     ④ **strict（默认）**：只有"该工单含本单全部产品"才填（本单据与工单一一对得上）；
        **lenient**：允许部分覆盖（该工单只含本单部分产品），并把覆盖率写进留痕，供事后复核。
   另：单产品的单顺带把 `工单行号` 填成该工单里对这个产品的那一行（plang.pl_xc），
       多产品单**不填**工单行号（一行对不上多个产品，留空=占整单，语义才对）。

   ── 三、实测（2026-10-22 正式库 HSDZ_MES，231 张空单）────────────────────
     ② 全覆盖 = 31 张（strict 会写这 31 张）
     ④ 部分覆盖 = 113 张（lenient 才会写；strict 不动）
     ③ 无候选 = 87 张（这些产品在 plang 里根本没有工单，谁也补不出来）
   报告口径完全同一套：tools\verify\finish-in-wo-backfill-report.sql（先跑它看清单）。

   ── 四、安全 ────────────────────────────────────────────────────────────
   · **只填空值**：`ISNULL(加工单号,'') = ''` —— 已有值的一行都不碰（含金蝶导入的真号）；
   · 全程一个事务；任一守卫不过就 ROLLBACK + THROW；
   · 每改一张单写一条 `yj_usage_log` 留痕（panel_name=产成品入库单,
     action_name=`数据修复·补齐加工单号(覆盖m/n)→<工单号>`）⇒ 可审计、可精确回滚
     （配套 tools\rollback-finish-in-wo-backfill-20261022.sql）。
   · 幂等：跑第二遍命中 0 张，输出 RESULT: FINISH-IN-WO-NOOP。

   执行（tools 目录）：两个账套都要跑
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-finish-in-wo-backfill-20261022.sql
     YINJIA_SQL_DB=HSDZ_MES_TEST java ... DbSync.java run migrate-finish-in-wo-backfill-20261022.sql
   放宽到部分覆盖：把下面的 @Mode 改成 N'lenient' 再跑（只补仍然空着的，不会覆盖 strict 的结果）。
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @Mode      nvarchar(20)  = N'strict';         -- strict | lenient
DECLARE @MaxDays   int           = 180;               -- 工单日期距入库日上限(天)
DECLARE @Operator  nvarchar(100) = N'datafix-finish-in-wo';
DECLARE @PanelName nvarchar(200) = N'产成品入库单';
DECLARE @Filled    int           = 0;
DECLARE @Before    int           = 0;
DECLARE @After     int           = 0;

IF @Mode NOT IN (N'strict', N'lenient')
    THROW 51000, N'@Mode 只能是 strict 或 lenient。', 1;

BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
    IF OBJECT_ID('tempdb..#q') IS NOT NULL DROP TABLE #q;
    IF OBJECT_ID('tempdb..#c') IS NOT NULL DROP TABLE #c;
    IF OBJECT_ID('tempdb..#plan') IS NOT NULL DROP TABLE #plan;

    CREATE TABLE #r (单据编号 nvarchar(400) NOT NULL PRIMARY KEY,
                     单据日期 date NULL, 产品数 int NULL);
    CREATE TABLE #q (单据编号 nvarchar(400), 产品编码 nvarchar(200), 数量 float);
    CREATE TABLE #c (单据编号 nvarchar(400), 产品数 int, 工单号 nvarchar(56),
                     覆盖产品数 int, 工单日期 date, 时间差天 int, 数量差 float);
    CREATE TABLE #plan (单据编号 nvarchar(400) NOT NULL PRIMARY KEY,
                        产品数 int, 覆盖产品数 int, 新加工单号 nvarchar(56),
                        工单日期 date, 时间差天 int, 工单行号 int);

    INSERT INTO #r (单据编号, 单据日期, 产品数)
    SELECT h.单据编号, CAST(h.单据日期 AS date),
           COUNT(DISTINCT RTRIM(LTRIM(l.产品编码)))
      FROM dbo.bd_finish_in h
      JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
     WHERE ISNULL(h.加工单号, N'') = N''
     GROUP BY h.单据编号, CAST(h.单据日期 AS date);

    INSERT INTO #q (单据编号, 产品编码, 数量)
    SELECT l.单据编号, RTRIM(LTRIM(l.产品编码)), SUM(ISNULL(l.实收数量, 0))
      FROM dbo.bl_finish_in l
     WHERE l.单据编号 IN (SELECT 单据编号 FROM #r)
     GROUP BY l.单据编号, RTRIM(LTRIM(l.产品编码));

    -- 候选：入库单 × 工单号（时间闸门：工单最晚一行日期 ≤ 入库日，且不早于 @MaxDays）
    INSERT INTO #c (单据编号, 产品数, 工单号, 覆盖产品数, 工单日期, 时间差天, 数量差)
    SELECT r.单据编号, r.产品数, p.pl_no,
           COUNT(DISTINCT RTRIM(LTRIM(p.dm))),
           MAX(CAST(p.pl_date AS date)),
           DATEDIFF(day, MAX(CAST(p.pl_date AS date)), r.单据日期),
           ABS(ISNULL(SUM(p.pl_sl), 0) - (SELECT ISNULL(SUM(q.数量), 0) FROM #q q
                                           WHERE q.单据编号 = r.单据编号
                                             AND EXISTS (SELECT 1 FROM dbo.plang p2
                                                          WHERE p2.pl_no = p.pl_no
                                                            AND RTRIM(LTRIM(p2.dm)) = q.产品编码)))
      FROM #r r
      JOIN dbo.plang p
        ON CAST(p.pl_date AS date) <= r.单据日期
       AND CAST(p.pl_date AS date) >= DATEADD(day, -@MaxDays, r.单据日期)
       AND ISNULL(p.pl_no, N'') <> N''
       AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l
                    WHERE l.单据编号 = r.单据编号
                      AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm)))
     GROUP BY r.单据编号, r.产品数, p.pl_no, r.单据日期;

    -- 每单定一个工单号
    INSERT INTO #plan (单据编号, 产品数, 覆盖产品数, 新加工单号, 工单日期, 时间差天, 工单行号)
    SELECT x.单据编号, x.产品数, x.覆盖产品数, x.工单号, x.工单日期, x.时间差天,
           CASE WHEN x.产品数 = 1
                THEN (SELECT TOP 1 p.pl_xc FROM dbo.plang p
                       WHERE p.pl_no = x.工单号
                         AND RTRIM(LTRIM(p.dm)) = (SELECT TOP 1 RTRIM(LTRIM(l.产品编码)) FROM dbo.bl_finish_in l
                                                    WHERE l.单据编号 = x.单据编号)
                       ORDER BY p.pl_xc) END
      FROM (SELECT c.*, ROW_NUMBER() OVER (PARTITION BY c.单据编号
                                           ORDER BY c.覆盖产品数 DESC, c.时间差天 ASC,
                                                    c.数量差 ASC, c.工单号 DESC) AS rn
              FROM #c c) x
     WHERE x.rn = 1
       AND ((@Mode = N'strict'  AND x.覆盖产品数 = x.产品数)
         OR (@Mode = N'lenient' AND x.覆盖产品数 >= 1));

    /* ── 守卫 1：计划里每条都必须是真实工单号、时间差非负、单据仍为空 ───── */
    IF EXISTS (SELECT 1 FROM #plan pl
                WHERE NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no = pl.新加工单号))
        THROW 51000, N'补齐计划里出现了 plang 不存在的工单号。', 1;

    IF EXISTS (SELECT 1 FROM #plan pl WHERE pl.时间差天 < 0)
        THROW 51000, N'补齐计划里出现"工单晚于入库"的行（时间不合理）。', 1;

    IF EXISTS (SELECT 1 FROM #plan pl
                JOIN dbo.bd_finish_in h ON h.单据编号 = pl.单据编号
               WHERE ISNULL(h.加工单号, N'') <> N'')
        THROW 51000, N'补齐计划里有单据已经带加工单号（本脚本绝不覆盖既有值）。', 1;

    SELECT @Before = COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'';

    /* ── 只填空值 ─────────────────────────────────────────────────────────── */
    UPDATE h
       SET h.加工单号 = pl.新加工单号,
           h.工单行号 = CASE WHEN h.工单行号 IS NULL THEN pl.工单行号 ELSE h.工单行号 END
      FROM dbo.bd_finish_in h
      JOIN #plan pl ON pl.单据编号 = h.单据编号
     WHERE ISNULL(h.加工单号, N'') = N'';

    SET @Filled = @@ROWCOUNT;

    IF @Filled <> (SELECT COUNT(*) FROM #plan)
        THROW 51000, N'实际更新行数与补齐计划不一致（可能有并发修改）。', 1;

    /* ── 留痕（yj_usage_log：一张单一条，可据此精确回滚）──────────────────── */
    INSERT INTO dbo.yj_usage_log (user_name, real_name, event_type, panel_name, action_name,
                                  doc_no, ip, created_at, 工单行号)
    SELECT @Operator, N'数据修复脚本', 'action', @PanelName,
           N'数据修复·补齐加工单号(覆盖' + CONVERT(nvarchar(10), pl.覆盖产品数)
             + N'/' + CONVERT(nvarchar(10), pl.产品数) + N'/' + @Mode + N')→' + pl.新加工单号,
           pl.单据编号, NULL, SYSDATETIME(), pl.工单行号
      FROM #plan pl;

    /* ── 守卫 2：改完复查 ─────────────────────────────────────────────────── */
    SELECT @After = COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'';
    IF @After <> @Before + @Filled
        THROW 51000, N'改后复核失败：非空加工单号数不等于 改前+本次。', 1;

    IF EXISTS (SELECT 1 FROM dbo.bd_finish_in h
                JOIN #plan pl ON pl.单据编号 = h.单据编号
               WHERE h.加工单号 <> pl.新加工单号)
        THROW 51000, N'改后复核失败：有单据的加工单号与计划不符。', 1;

    COMMIT TRANSACTION;

    -- 变更明细落到会话级临时表（末批在另一个批次里读它，变量跨批次不保留）
    SELECT pl.单据编号, h.单据日期, pl.产品数, pl.覆盖产品数,
           pl.新加工单号, pl.工单日期, pl.时间差天, pl.工单行号 AS 已填工单行号
      INTO #out
      FROM #plan pl JOIN dbo.bd_finish_in h ON h.单据编号 = pl.单据编号;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── 结果：变更明细 + 汇总 + 机器可读末行 ───────────────────────────────────
   ⚠ 用 GO 切成独立批次：SQL Server JDBC 对"一个批次里多条语句"只回第一个结果集，
      不切批的话下面的结果集在 SqlRunner/DbSync 里看不到。
      变量是批次作用域的 ⇒ 汇总数据先落到临时表 #out，末批只读临时表（同一会话内有效）。 */
GO
IF OBJECT_ID('tempdb..#out') IS NULL
    SELECT CAST(NULL AS nvarchar(400)) AS 单据编号, CAST(NULL AS date) AS 单据日期,
           CAST(NULL AS int) AS 产品数, CAST(NULL AS int) AS 覆盖产品数,
           CAST(NULL AS nvarchar(56)) AS 新加工单号, CAST(NULL AS date) AS 工单日期,
           CAST(NULL AS int) AS 时间差天, CAST(NULL AS int) AS 已填工单行号
      INTO #out WHERE 1 = 0;
GO
SELECT 单据编号, 单据日期, 产品数, 覆盖产品数, 新加工单号, 工单日期, 时间差天, 已填工单行号
  FROM #out ORDER BY 时间差天, 单据编号;
GO
SELECT CASE WHEN EXISTS (SELECT 1 FROM #out)
            THEN N'RESULT: FINISH-IN-WO-FILLED-' + CONVERT(nvarchar(10), (SELECT COUNT(*) FROM #out))
            ELSE N'RESULT: FINISH-IN-WO-NOOP' END AS 结果,
       (SELECT COUNT(*) FROM #out) AS 本次补齐单数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'') AS 现有加工单号单数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'') AS 仍为空单数;
