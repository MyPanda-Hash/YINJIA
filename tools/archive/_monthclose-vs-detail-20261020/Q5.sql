SET NOCOUNT ON;
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @jz nvarchar(20) = N'JZ-' + REPLACE(@prev,'-','');
DECLARE @cStart date = CONVERT(date, LEFT(CONVERT(nvarchar(7),GETDATE(),120),7) + '-01');
DECLARE @cEndEx date = DATEADD(month,1,@cStart);

PRINT N'=== 1 结转行的 单价/金额 空缺情况 ===';
;WITH x AS (
  SELECT CASE WHEN 单价 IS NULL THEN N'单价NULL' ELSE N'单价有值' END AS k1,
         CASE WHEN 金额 IS NULL THEN N'金额NULL' ELSE N'金额有值' END AS k2
  FROM inh WHERE 单据类型=N'月结结转' AND 单据编号=@jz
)
SELECT k1 AS 单价, k2 AS 金额, COUNT(*) AS 行数 FROM x GROUP BY k1, k2;

PRINT N'=== 2 结转行 明细字段空缺 ===' ;
;WITH x AS (
  SELECT CASE WHEN ISNULL(RTRIM(物料名称),N'')=N'' THEN 1 ELSE 0 END AS a1,
         CASE WHEN ISNULL(RTRIM(规格型号),N'')=N'' THEN 1 ELSE 0 END AS a2,
         CASE WHEN ISNULL(RTRIM(计量单位),N'')=N'' THEN 1 ELSE 0 END AS a3,
         CASE WHEN ISNULL(RTRIM(仓库名称),N'')=N'' THEN 1 ELSE 0 END AS a4,
         CASE WHEN ISNULL(RTRIM(往来单位),N'')=N'' THEN 1 ELSE 0 END AS a5,
         CASE WHEN ISNULL(RTRIM(经手人),N'')=N'' THEN 1 ELSE 0 END AS a6
  FROM inh WHERE 单据类型=N'月结结转' AND 单据编号=@jz
)
SELECT COUNT(*) AS 结转行, SUM(a1) AS 缺物料名称, SUM(a2) AS 缺规格, SUM(a3) AS 缺单位,
       SUM(a4) AS 缺仓库名称, SUM(a5) AS 缺往来单位, SUM(a6) AS 缺经手人
FROM x;

PRINT N'=== 3 bl_stock_close 行表 单价/最晚出库日期 空缺 ===' ;
;WITH x AS (
  SELECT CASE WHEN 单价 IS NULL THEN 1 ELSE 0 END AS b1,
         CASE WHEN 最晚出库日期 IS NULL THEN 1 ELSE 0 END AS b2
  FROM bl_stock_close WHERE 期间=@prev
)
SELECT COUNT(*) AS 行数, SUM(b1) AS 缺单价, SUM(b2) AS 缺最晚出库日期 FROM x;

PRINT N'=== 4 当月有流水但该 物料+仓库 上月无结转行的键数 ===' ;
;WITH f AS (
  SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期>=@cStart AND 单据日期<@cEndEx
  UNION
  SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N'') FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
), x AS (
  SELECT 1 AS one FROM f
   WHERE NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
        AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c)
)
SELECT COUNT(*) AS 无结转行的键数 FROM x;
