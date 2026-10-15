-- q-01-monthclose-dryrun.sql — 月结口径**空跑**(不写任何数据):按 (物料,仓库,批号) 算出期初/本期入/本期出/期末
-- 口径与 StockMonthCloseService 完全同源:排除「月结结转」行;期初 = 期间开始前 (inh − outh) 的累计
-- 用法:把 @period 换成要试算的期间
SET NOCOUNT ON;
DECLARE @period nvarchar(7) = N'2026-10';
DECLARE @start datetime = DATEADD(day, 0, CONVERT(datetime, @period + N'-01'));
DECLARE @endEx datetime = DATEADD(month, 1, @start);

SELECT N'总览' AS k, @period AS 期间, @start AS 起, @endEx AS 止不含,
       (SELECT COUNT(*) FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
          AND 单据日期 >= @start AND 单据日期 < @endEx) AS 期间入库行,
       (SELECT COUNT(*) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
          AND 单据日期 >= @start AND 单据日期 < @endEx) AS 期间出库行,
       (SELECT COUNT(*) FROM inh WHERE 单据类型=N'月结结转') AS 已有结转行;
GO

DECLARE @period nvarchar(7) = N'2026-10';
DECLARE @start datetime = CONVERT(datetime, @period + N'-01');
DECLARE @endEx datetime = DATEADD(month, 1, @start);

WITH k AS (
  SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,
         SUM(CASE WHEN 单据日期 >= @start AND 单据日期 < @endEx THEN 数量 ELSE 0 END) AS 本期入,
         SUM(CASE WHEN 单据日期 < @start THEN 数量 ELSE 0 END) AS 期初入,
         0 AS 期初出, 0 AS 本期出
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')
  UNION ALL
  SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N''),
         0, 0,
         SUM(CASE WHEN 单据日期 < @start THEN 数量 ELSE 0 END),
         SUM(CASE WHEN 单据日期 >= @start AND 单据日期 < @endEx THEN 数量 ELSE 0 END)
  FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')
), g AS (
  SELECT w, c, l, SUM(期初入) AS 期初入, SUM(期初出) AS 期初出, SUM(本期入) AS 本期入, SUM(本期出) AS 本期出 FROM k GROUP BY w, c, l
)
SELECT N'合计' AS k, COUNT(*) AS 键数,
       SUM(期初入 - 期初出) AS 期初合计,
       SUM(本期入) AS 本期入合计,
       SUM(本期出) AS 本期出合计,
       SUM(期初入 - 期初出 + 本期入 - 本期出) AS 期末合计,
       SUM(CASE WHEN 期初入 - 期初出 + 本期入 - 本期出 < 0 THEN 1 ELSE 0 END) AS 期末为负键数,
       SUM(CASE WHEN 期初入 - 期初出 + 本期入 - 本期出 <> 0 THEN 1 ELSE 0 END) AS 会写结转行的键数
FROM g;
GO

-- 期末为负 / 无批号 的样本(月结前要心里有数)
DECLARE @period nvarchar(7) = N'2026-10';
DECLARE @start datetime = CONVERT(datetime, @period + N'-01');
DECLARE @endEx datetime = DATEADD(month, 1, @start);
SELECT N'期末为负样本(前 8)' AS k, w, c, l, 期初, 本期入, 本期出, 期末 FROM (
  SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,
         SUM(CASE WHEN 单据日期 < @start THEN 数量 ELSE 0 END) AS 期初,
         SUM(CASE WHEN 单据日期 >= @start AND 单据日期 < @endEx THEN 数量 ELSE 0 END) AS 本期入, 0 AS 本期出,
         SUM(数量) AS 期末
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'')
) t WHERE 期末 < 0 ORDER BY 期末 OFFSET 0 ROWS FETCH NEXT 8 ROWS ONLY;
GO
