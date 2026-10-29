/* ============================================================================
   verify\finish-in-wo-backfill-report.sql  —— 产成品入库单「加工单号」补齐 **只读报告**
   不改任何数据。用法（tools 目录下）：

     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
       "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES;encrypt=false" yinjia <密码> ^
       verify\finish-in-wo-backfill-report.sql

   口径（与 tools\migrate-finish-in-wo-backfill-20261022.sql **完全同一套**，先看再改）：
   ────────────────────────────────────────────────────────────────────────
   1. 加工单号 = **生产工单号 plang.pl_no**（不是金蝶的号）。
      依据现役代码：WorkOrderPickingService「加工单号 = 工单号」、ButtonService 写头
      `head.put("加工单号", wo)`、WorkOrderTrace/ScheduleBoard 均按
      `bd_finish_in.加工单号 (+ 工单行号)` 反查工单 ⇒ 这一列只能是 plang.pl_no。
   2. 候选 = 本入库单的**产品**出现在某个工单号的行里（bl_finish_in.产品编码 = plang.dm，去首尾空格）；
   3. 时间必须"合理"：该工单的**最晚一行工单日期 ≤ 入库单日期**（工单不能晚于入库），
      且距今不远于 @MaxDays 天（默认 180，可改）；
   4. 一张入库单只能落一个工单号 ⇒ 按「覆盖产品数 desc → 时间差 asc → 数量差 asc → 单号 desc」
      取第一条；**只有全覆盖（该工单含本单全部产品）才算"可填"**，部分覆盖只列出、不自动填。

   输出四段：① 分层汇总 ② 可填清单(全覆盖) ③ 部分覆盖(前 60) ④ 无候选(前 30)
   末行 RESULT: REPORT-OK
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @MaxDays int = 180;

IF OBJECT_ID('tempdb..#r') IS NOT NULL DROP TABLE #r;
IF OBJECT_ID('tempdb..#q') IS NOT NULL DROP TABLE #q;
IF OBJECT_ID('tempdb..#c') IS NOT NULL DROP TABLE #c;

CREATE TABLE #r (单据编号 nvarchar(400) NOT NULL PRIMARY KEY,
                 单据日期 date NULL, 产品数 int NULL, 明细行数 int NULL);
CREATE TABLE #q (单据编号 nvarchar(400), 产品编码 nvarchar(200), 数量 float);
CREATE TABLE #c (单据编号 nvarchar(400), 产品数 int, 工单号 nvarchar(56),
                 覆盖产品数 int, 工单日期 date, 时间差天 int, 数量差 float);

/* 1. 待补入库单（加工单号为空） */
INSERT INTO #r (单据编号, 单据日期, 产品数, 明细行数)
SELECT h.单据编号, CAST(h.单据日期 AS date),
       COUNT(DISTINCT RTRIM(LTRIM(l.产品编码))), COUNT(*)
  FROM dbo.bd_finish_in h
  JOIN dbo.bl_finish_in l ON l.单据编号 = h.单据编号
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY h.单据编号, CAST(h.单据日期 AS date);

/* 2. 每单每产品的合计数量（数量接近度做次序，不参与判定） */
INSERT INTO #q (单据编号, 产品编码, 数量)
SELECT l.单据编号, RTRIM(LTRIM(l.产品编码)), SUM(ISNULL(l.实收数量, 0))
  FROM dbo.bl_finish_in l
 WHERE l.单据编号 IN (SELECT 单据编号 FROM #r)
 GROUP BY l.单据编号, RTRIM(LTRIM(l.产品编码));

/* 3. 候选：入库单 × 工单号 */
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
GO

SELECT '=== ① 分层汇总 ===' AS 段落;
SELECT CASE WHEN c.工单号 IS NULL THEN N'③ 无候选(产品在工单里查不到)'
            WHEN c.覆盖产品数 = r.产品数 THEN N'② 全覆盖(可自动填)'
            ELSE N'④ 部分覆盖(不建议自动填)' END AS 类别,
       COUNT(*) AS 单数, SUM(r.产品数) AS 产品数合计, SUM(r.明细行数) AS 明细行合计
  FROM #r r
  LEFT JOIN (
        SELECT 单据编号, 工单号, 覆盖产品数,
               ROW_NUMBER() OVER (PARTITION BY 单据编号
                                  ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 数量差 ASC, 工单号 DESC) AS rn
          FROM #c) c ON c.单据编号 = r.单据编号 AND c.rn = 1
 GROUP BY CASE WHEN c.工单号 IS NULL THEN N'③ 无候选(产品在工单里查不到)'
               WHEN c.覆盖产品数 = r.产品数 THEN N'② 全覆盖(可自动填)'
               ELSE N'④ 部分覆盖(不建议自动填)' END
 ORDER BY 类别;
GO

SELECT '=== ② 可填清单：全覆盖（strict 模式写的就是这些） ===' AS 段落;
WITH best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号
                               ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 数量差 ASC, 工单号 DESC) AS rn
    FROM #c
)
SELECT r.单据编号, r.单据日期, r.产品数, b.工单号 AS 建议加工单号, b.工单日期, b.时间差天,
       CASE WHEN r.产品数 = 1
            THEN (SELECT TOP 1 p.pl_xc FROM dbo.plang p
                   WHERE p.pl_no = b.工单号
                     AND RTRIM(LTRIM(p.dm)) = (SELECT TOP 1 RTRIM(LTRIM(l.产品编码)) FROM dbo.bl_finish_in l
                                                WHERE l.单据编号 = r.单据编号)
                   ORDER BY p.pl_xc) END AS 建议工单行号,
       (SELECT STUFF((SELECT DISTINCT N',' + y.产品编码 FROM dbo.bl_finish_in y
                       WHERE y.单据编号 = r.单据编号
                       FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 入库产品,
       CONVERT(decimal(18, 2), b.数量差) AS 数量差
  FROM best b JOIN #r r ON r.单据编号 = b.单据编号
 WHERE b.rn = 1 AND b.覆盖产品数 = r.产品数
 ORDER BY b.时间差天, r.单据编号 DESC;
GO

SELECT '=== ③ 部分覆盖（前 60：只覆盖到本单部分产品，不自动填） ===' AS 段落;
WITH best AS (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY 单据编号
                               ORDER BY 覆盖产品数 DESC, 时间差天 ASC, 数量差 ASC, 工单号 DESC) AS rn
    FROM #c
)
SELECT TOP 60 r.单据编号, r.单据日期, r.产品数, b.覆盖产品数,
       CONVERT(nvarchar(10), b.覆盖产品数) + N'/' + CONVERT(nvarchar(10), r.产品数) AS 覆盖率,
       b.工单号 AS 最接近工单号, b.工单日期, b.时间差天
  FROM best b JOIN #r r ON r.单据编号 = b.单据编号
 WHERE b.rn = 1 AND b.覆盖产品数 < r.产品数
 ORDER BY b.覆盖产品数 DESC, b.时间差天 ASC, r.单据编号 DESC;
GO

SELECT '=== ④ 无候选（前 30：本单产品在时间窗内没有任何工单） ===' AS 段落;
SELECT TOP 30 r.单据编号, r.单据日期, r.产品数,
       (SELECT STUFF((SELECT DISTINCT N',' + y.产品编码 FROM dbo.bl_finish_in y
                       WHERE y.单据编号 = r.单据编号
                       FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 1, N'')) AS 入库产品
  FROM #r r
 WHERE NOT EXISTS (SELECT 1 FROM #c c WHERE c.单据编号 = r.单据编号)
 ORDER BY r.单据编号 DESC;
GO

SELECT N'RESULT: REPORT-OK' AS 结果;
