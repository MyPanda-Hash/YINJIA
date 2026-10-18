SET NOCOUNT ON;
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @cur  nvarchar(7) = LEFT(CONVERT(nvarchar(7), GETDATE(), 120), 7);
DECLARE @cStart date = CONVERT(date, @cur + '-01'), @cEndEx date = DATEADD(month,1,CONVERT(date, @cur + '-01'));
DECLARE @jz nvarchar(20) = N'JZ-' + REPLACE(@prev,'-','');

PRINT N'=== 1 明细行中带/不带上月结转行 ===';
;WITH x AS (
  SELECT k.wzdm w, ISNULL(RTRIM(k.ckdm),N'') c, ISNULL(RTRIM(k.lot_no),N'') l, k.yl,
    CASE WHEN EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
        AND ISNULL(RTRIM(i.物料编码),N'')=k.wzdm AND ISNULL(RTRIM(i.仓库编码),N'')=ISNULL(RTRIM(k.ckdm),N'')) THEN 1 ELSE 0 END AS 有结转行
  FROM kucun k
)
SELECT 有结转行, COUNT(*) 明细行数, SUM(yl) 余额合计 FROM x GROUP BY 有结转行;

PRINT N'=== 2 明细里有、但上月没有该键(本月新增批次)===' ;
;WITH x AS (
  SELECT k.yl FROM kucun k
   WHERE NOT EXISTS (SELECT 1 FROM bl_stock_close b WHERE b.期间=@prev AND b.物料编码=k.wzdm
          AND b.仓库编码=ISNULL(RTRIM(k.ckdm),N'') AND ISNULL(RTRIM(b.批号),N'')=ISNULL(RTRIM(k.lot_no),N''))
)
SELECT COUNT(*) 键数, SUM(yl) 余额合计 FROM x;

PRINT N'=== 3 上月有非零结存、但今天明细里没有该键的 ===' ;
;WITH x AS (
  SELECT b.结存数量 jc,
    CASE WHEN EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
        AND ISNULL(RTRIM(i.物料编码),N'')=b.物料编码 AND ISNULL(RTRIM(i.仓库编码),N'')=b.仓库编码
        AND ISNULL(RTRIM(i.批号),N'')=ISNULL(RTRIM(b.批号),N'')) THEN 1 ELSE 0 END AS 有结转行
  FROM bl_stock_close b WHERE b.期间=@prev AND b.结存数量 <> 0
    AND NOT EXISTS (SELECT 1 FROM kucun q WHERE q.wzdm=b.物料编码 AND ISNULL(RTRIM(q.ckdm),N'')=b.仓库编码
          AND ISNULL(RTRIM(q.lot_no),N'')=ISNULL(RTRIM(b.批号),N''))
)
SELECT COUNT(*) 丢失键数, SUM(有结转行) 其中有结转行的, SUM(jc) 结存合计 FROM x;

PRINT N'=== 4 当月有出入库、但没有上月结转行的键数 ===' ;
;WITH f AS (
  SELECT ISNULL(RTRIM(物料编码),N'') w, ISNULL(RTRIM(仓库编码),N'') c, ISNULL(RTRIM(批号),N'') l FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期>=@cStart AND 单据日期<@cEndEx
  UNION
  SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'') FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
), x AS (
  SELECT 1 AS one FROM f
   WHERE NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
        AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c AND ISNULL(RTRIM(i.批号),N'')=f.l)
)
SELECT COUNT(*) 键数 FROM x;

PRINT N'=== 5 当月出库行里空批号的条数 ===' ;
;WITH x AS (
  SELECT CASE WHEN ISNULL(RTRIM(批号),N'')=N'' THEN 1 ELSE 0 END AS 空批号 FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
)
SELECT COUNT(*) 当月出库行数, SUM(空批号) 空批号出库行 FROM x;
