/* ============================================================================
   migrate-finish-in-wo-backfill-full-20261022.sql
   产成品入库单「加工单号」**放宽补齐（第二轮）** —— 把严格脚本剩下的空单全部落上工单号

   用户口径（2026-10-22）：「写个脚本可以补齐成产品入库的加工单号。按照有的补齐。要合理，符合时间。」
                        → 第二轮：「放宽要全补上，并且把补充的脚本发给我，方便服务器直接用。」

   ── 两轮的分工（别混） ──────────────────────────────────────────────────
   · 第一轮 tools/migrate-finish-in-wo-backfill-20261022.sql（strict）：
     只填"该工单含本单全部产品 + 工单日期 ≤ 入库日 + 180 天内"的 31 张（已执行、字节不再改）；
   · 本轮（本脚本）：**只处理仍然空着的**（正式库 200 张），按下面 M2/M3/M4 三档放宽：
       M2 产品对得上 + 工单日期 ≤ 入库日（时间合理）        —— 只对上部分产品也认
       M3 产品对得上，但工单日期**晚于**入库日（时间越界）   —— 先入库后开工，业务上说不通，但产品是对的
       M4 产品**完全对不上**任何工单（无产品依据）           —— 按"时间最近"硬落一张工单
   ⚠ M3/M4 是**放宽**的结果，不是事实。每条都写进 yj_usage_log 留痕并带档位标记：
       action_name = 数据修复·补齐加工单号(覆盖m/n/M2)→GD-2026-10-0117
     事后可按 M3/M4 过滤复核，或整批回滚（tools/rollback-finish-in-wo-backfill-20261022.sql）。

   ── 判定次序（每张空单取第一条） ───────────────────────────────────────────
     档位升序(M2<M3<M4) → 覆盖产品数 desc → |时间差| asc → 数量差 asc → 工单号 desc
     · M2/M3 的覆盖产品数 = 该工单行里出现的本单产品个数（编码对编码，去首尾空格）；
     · M4 没有产品依据，覆盖产品数恒 0，只能比时间；
     · 工单行号只在"单产品 + M2/M3（有产品依据）"时填（= 该工单里对这个产品的那一行 pl_xc）；
       M4 与多产品单不填（留空 = 占整单，语义才对）。

   ── 安全 ────────────────────────────────────────────────────────────────
   · **只填空值**（ISNULL(加工单号,'')=''）—— 第一轮的 31 张、金蝶导入的真号一行不碰；
   · 全程一个事务；守卫：目标工单必须真实存在、任何非空值都不许被覆盖、改后复核行数；
   · 每张单一条 yj_usage_log 留痕 ⇒ 可审计、可整批回滚；
   · 幂等：再跑一次命中 0 张 → RESULT: FINISH-IN-WO-FULL-NOOP。

   执行（tools 目录，两个账套都要跑）：
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar DbSync.java run migrate-finish-in-wo-backfill-full-20261022.sql
   ============================================================================ */
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() NOT IN (N'HSDZ_MES', N'HSDZ_MES_TEST')
    THROW 51000, N'请显式选择 HSDZ_MES 或 HSDZ_MES_TEST，禁止在其他数据库执行。', 1;

DECLARE @MaxDays    int           = 180;   -- M2 的时间窗（超过算 M3）
DECLARE @Operator   nvarchar(100) = N'datafix-finish-in-wo';
DECLARE @PanelName  nvarchar(200) = N'产成品入库单';
DECLARE @Filled     int = 0;
DECLARE @Before     int = 0;
DECLARE @After      int = 0;

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
                     档 nvarchar(2), 覆盖产品数 int, 工单日期 date, 时间差天 int, 数量差 float);
    CREATE TABLE #plan (单据编号 nvarchar(400) NOT NULL PRIMARY KEY,
                        产品数 int, 档 nvarchar(2), 覆盖产品数 int, 新加工单号 nvarchar(56),
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

    /* ── 候选 A：产品对得上（M2 时间合理 / M3 工单晚于入库） ───────────────── */
    INSERT INTO #c (单据编号, 产品数, 工单号, 档, 覆盖产品数, 工单日期, 时间差天, 数量差)
    SELECT r.单据编号, r.产品数, p.pl_no,
           CASE WHEN DATEDIFF(day, MAX(CAST(p.pl_date AS date)), r.单据日期) BETWEEN 0 AND @MaxDays
                THEN N'M2' ELSE N'M3' END,
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
        ON ISNULL(p.pl_no, N'') <> N''
       AND EXISTS (SELECT 1 FROM dbo.bl_finish_in l
                    WHERE l.单据编号 = r.单据编号
                      AND RTRIM(LTRIM(l.产品编码)) = RTRIM(LTRIM(p.dm)))
     GROUP BY r.单据编号, r.产品数, p.pl_no, r.单据日期;

    /* ── 候选 B：产品完全对不上的单（M4）——按时间最近硬落一张工单 ─────────── */
    INSERT INTO #c (单据编号, 产品数, 工单号, 档, 覆盖产品数, 工单日期, 时间差天, 数量差)
    SELECT r.单据编号, r.产品数, w.工单号, N'M4', 0, w.工单日期,
           DATEDIFF(day, w.工单日期, r.单据日期), 0
      FROM #r r
      CROSS JOIN (SELECT p.pl_no AS 工单号, MAX(CAST(p.pl_date AS date)) AS 工单日期
                    FROM dbo.plang p WHERE ISNULL(p.pl_no, N'') <> N''
                   GROUP BY p.pl_no) w
     WHERE NOT EXISTS (SELECT 1 FROM #c c WHERE c.单据编号 = r.单据编号);

    /* ── 每单定一个工单号 ─────────────────────────────────────────────────── */
    INSERT INTO #plan (单据编号, 产品数, 档, 覆盖产品数, 新加工单号, 工单日期, 时间差天, 工单行号)
    SELECT x.单据编号, x.产品数, x.档, x.覆盖产品数, x.工单号, x.工单日期, x.时间差天,
           CASE WHEN x.产品数 = 1 AND x.档 IN (N'M2', N'M3')
                THEN (SELECT TOP 1 p.pl_xc FROM dbo.plang p
                       WHERE p.pl_no = x.工单号
                         AND RTRIM(LTRIM(p.dm)) = (SELECT TOP 1 RTRIM(LTRIM(l.产品编码))
                                                     FROM dbo.bl_finish_in l WHERE l.单据编号 = x.单据编号)
                       ORDER BY p.pl_xc) END
      FROM (SELECT c.*, ROW_NUMBER() OVER (PARTITION BY c.单据编号
                                           ORDER BY c.档 ASC, c.覆盖产品数 DESC,
                                                    ABS(c.时间差天) ASC, c.数量差 ASC, c.工单号 DESC) AS rn
              FROM #c c) x
     WHERE x.rn = 1;

    /* ── 守卫 ─────────────────────────────────────────────────────────────── */
    IF EXISTS (SELECT 1 FROM #plan pl
                WHERE NOT EXISTS (SELECT 1 FROM dbo.plang p WHERE p.pl_no = pl.新加工单号))
        THROW 51000, N'补齐计划里出现了 plang 不存在的工单号。', 1;

    IF EXISTS (SELECT 1 FROM #plan pl
                JOIN dbo.bd_finish_in h ON h.单据编号 = pl.单据编号
               WHERE ISNULL(h.加工单号, N'') <> N'')
        THROW 51000, N'补齐计划里有单据已经带加工单号（本脚本绝不覆盖既有值）。', 1;

    SELECT @Before = COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'';

    UPDATE h
       SET h.加工单号 = pl.新加工单号,
           h.工单行号 = CASE WHEN h.工单行号 IS NULL THEN pl.工单行号 ELSE h.工单行号 END
      FROM dbo.bd_finish_in h
      JOIN #plan pl ON pl.单据编号 = h.单据编号
     WHERE ISNULL(h.加工单号, N'') = N'';

    SET @Filled = @@ROWCOUNT;

    IF @Filled <> (SELECT COUNT(*) FROM #plan)
        THROW 51000, N'实际更新行数与补齐计划不一致（可能有并发修改）。', 1;

    INSERT INTO dbo.yj_usage_log (user_name, real_name, event_type, panel_name, action_name,
                                  doc_no, ip, created_at, 工单行号)
    SELECT @Operator, N'数据修复脚本', 'action', @PanelName,
           N'数据修复·补齐加工单号(覆盖' + CONVERT(nvarchar(10), pl.覆盖产品数)
             + N'/' + CONVERT(nvarchar(10), pl.产品数) + N'/' + pl.档 + N')→' + pl.新加工单号,
           pl.单据编号, NULL, SYSDATETIME(), pl.工单行号
      FROM #plan pl;

    SELECT @After = COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'';
    IF @After <> @Before + @Filled
        THROW 51000, N'改后复核失败：非空加工单号数不等于 改前+本次。', 1;

    IF EXISTS (SELECT 1 FROM dbo.bd_finish_in h
                JOIN #plan pl ON pl.单据编号 = h.单据编号
               WHERE h.加工单号 <> pl.新加工单号)
        THROW 51000, N'改后复核失败：有单据的加工单号与计划不符。', 1;

    COMMIT TRANSACTION;

    SELECT pl.单据编号, h.单据日期, pl.档, pl.产品数, pl.覆盖产品数,
           pl.新加工单号, pl.工单日期, pl.时间差天, pl.工单行号 AS 已填工单行号
      INTO #out
      FROM #plan pl JOIN dbo.bd_finish_in h ON h.单据编号 = pl.单据编号;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;

/* ── 结果（GO 切批：JDBC 对一个批次只回第一个结果集；变量/临时表同会话内有效）── */
GO
IF OBJECT_ID('tempdb..#out') IS NULL
    SELECT CAST(NULL AS nvarchar(400)) AS 单据编号, CAST(NULL AS date) AS 单据日期,
           CAST(NULL AS nvarchar(2)) AS 档, CAST(NULL AS int) AS 产品数,
           CAST(NULL AS int) AS 覆盖产品数, CAST(NULL AS nvarchar(56)) AS 新加工单号,
           CAST(NULL AS date) AS 工单日期, CAST(NULL AS int) AS 时间差天,
           CAST(NULL AS int) AS 已填工单行号
      INTO #out WHERE 1 = 0;
GO
SELECT 档, COUNT(*) AS 单数, MIN(时间差天) AS 最小时间差, MAX(时间差天) AS 最大时间差
  FROM #out GROUP BY 档 ORDER BY 档;
GO
SELECT 单据编号, 单据日期, 档, 产品数, 覆盖产品数, 新加工单号, 工单日期, 时间差天, 已填工单行号
  FROM #out ORDER BY 档, 时间差天, 单据编号;
GO
SELECT CASE WHEN (SELECT COUNT(*) FROM #out) > 0
            THEN N'RESULT: FINISH-IN-WO-FULL-' + CONVERT(nvarchar(10), (SELECT COUNT(*) FROM #out))
            ELSE N'RESULT: FINISH-IN-WO-FULL-NOOP' END AS 结果,
       (SELECT COUNT(*) FROM #out WHERE 档 = N'M2') AS M2_产品对上_时间合理,
       (SELECT COUNT(*) FROM #out WHERE 档 = N'M3') AS M3_产品对上_工单晚于入库,
       (SELECT COUNT(*) FROM #out WHERE 档 = N'M4') AS M4_无产品依据_按时间最近,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'') AS 现有加工单号单数,
       (SELECT COUNT(*) FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') = N'') AS 仍为空单数;
