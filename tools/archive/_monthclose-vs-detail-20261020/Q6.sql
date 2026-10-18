SET NOCOUNT ON;
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @cur  nvarchar(7) = LEFT(CONVERT(nvarchar(7), GETDATE(), 120), 7);
DECLARE @cStart date = CONVERT(date, @cur + '-01'), @cEndEx date = DATEADD(month,1,CONVERT(date, @cur + '-01'));
DECLARE @jz nvarchar(20) = N'JZ-' + REPLACE(@prev,'-','');

PRINT N'=== 面板 STOCK_DETAIL 指向 ===' ;
SELECT panel_code, line_table FROM yj_panel WHERE panel_code = 'STOCK_DETAIL';

PRINT N'=== 1 展开区差异的键(当月有出入库 + 上月无结转行),按是否有 上月快照 分类 ===';
;WITH f AS (
  SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期>=@cStart AND 单据日期<@cEndEx
  UNION
  SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N'') FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
), x AS (
  SELECT f.w, f.c,
    CASE WHEN EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
        AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c) THEN 1 ELSE 0 END AS 有结转行,
    CASE WHEN EXISTS (SELECT 1 FROM bl_stock_close b WHERE b.期间=@prev AND b.物料编码=f.w AND b.仓库编码=f.c) THEN 1 ELSE 0 END AS 有上月快照
  FROM f WHERE NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
        AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c)
)
SELECT 有上月快照, COUNT(*) AS 键数 FROM x GROUP BY 有上月快照;

PRINT N'=== 2 当月出库「吃老批次」的情形:出库行的 (物料,仓库) 当月无任何入库(只有出库) ===' ;
;WITH o AS (
  SELECT DISTINCT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
), x AS (
  SELECT o.w, o.c FROM o WHERE NOT EXISTS (SELECT 1 FROM inh i WHERE ISNULL(RTRIM(i.物料编码),N'')=o.w
      AND ISNULL(RTRIM(i.仓库编码),N'')=o.c AND ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.单据类型,'')<>N'月结结转'
      AND i.单据日期>=@cStart AND i.单据日期<@cEndEx)
)
SELECT COUNT(*) AS 只出不进的键数 FROM x;

PRINT N'=== 3 展开明细里「无批次号」组会出现吗:结转行批号全非空? ===';
;WITH x AS (SELECT CASE WHEN NULLIF(RTRIM(批号),N'') IS NULL THEN 1 ELSE 0 END AS blank FROM inh WHERE 单据类型=N'月结结转' AND 单据编号=@jz)
SELECT COUNT(*) AS 结转行, SUM(blank) AS 空批号行 FROM x;
;WITH x AS (SELECT DISTINCT CASE WHEN NULLIF(RTRIM(批号),N'') IS NULL THEN 1 ELSE 0 END AS blank FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx)
SELECT COUNT(*) AS 不同取值数, SUM(blank) AS 有空批号 FROM x;
