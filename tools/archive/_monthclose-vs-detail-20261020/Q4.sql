SET NOCOUNT ON;
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @cur  nvarchar(7) = LEFT(CONVERT(nvarchar(7), GETDATE(), 120), 7);
DECLARE @cStart date = CONVERT(date, @cur + '-01'), @cEndEx date = DATEADD(month,1,CONVERT(date, @cur + '-01'));
DECLARE @pStart date = CONVERT(date, @prev + '-01'), @pEndEx date = DATEADD(month,1,CONVERT(date, @prev + '-01'));

PRINT N'=== 当月单据按类型分布 ===' ;
;WITH f AS (
  SELECT ISNULL(单据类型,N'') t, 数量 q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
    AND 单据日期>=@cStart AND 单据日期<@cEndEx
  UNION ALL
  SELECT ISNULL(单据类型,N''), -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
)
SELECT t 单据类型, COUNT(*) 行数, SUM(q) 净数量 FROM f GROUP BY t ORDER BY COUNT(*) DESC;

PRINT N'=== 当月该物料该仓出入库的 存货(前 10) ===' ;
;WITH f AS (
  SELECT ISNULL(RTRIM(物料编码),N'') w, ISNULL(RTRIM(仓库编码),N'') c FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND 单据日期>=@cStart AND 单据日期<@cEndEx
  UNION ALL
  SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N'') FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期>=@cStart AND 单据日期<@cEndEx
)
SELECT TOP 10 w 存货, c 仓库, COUNT(*) 流水行数,
  (SELECT COUNT(*) FROM bl_stock_close b WHERE b.期间=@prev AND b.物料编码=f.w AND b.仓库编码=f.c) 上月快照行数,
  (SELECT COUNT(*) FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
     AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c) 上月结转行数
FROM f GROUP BY w, c ORDER BY COUNT(*) DESC;

PRINT N'=== 上月结转行总数 vs bl_stock_close 非零结存行 ===' ;
;WITH x AS (
  SELECT 1 one FROM bl_stock_close WHERE 期间=@prev AND 结存数量 <> 0
)
SELECT COUNT(*) 上月非零结存键 FROM x;
;WITH x AS (SELECT 1 one FROM inh WHERE 单据类型=N'月结结转' AND 单据编号=N'JZ-'+REPLACE(@prev,'-',''))
SELECT COUNT(*) 结转行 FROM x;

PRINT N'=== 上月结存>0 但结转行数与快照对不上的样本 ===' ;
;WITH x AS (
  SELECT b.物料编码 w, b.仓库编码 c, ISNULL(RTRIM(b.批号),N'') l, b.期初数量, b.入库数量, b.出库数量, b.结存数量,
    (SELECT COUNT(*) FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
       AND ISNULL(RTRIM(i.物料编码),N'')=b.物料编码 AND ISNULL(RTRIM(i.仓库编码),N'')=b.仓库编码
       AND ISNULL(RTRIM(i.批号),N'')=ISNULL(RTRIM(b.批号),N'')) 结转行数
  FROM bl_stock_close b WHERE b.期间=@prev AND b.结存数量 <> 0
    AND NOT EXISTS (SELECT 1 FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
       AND ISNULL(RTRIM(i.物料编码),N'')=b.物料编码 AND ISNULL(RTRIM(i.仓库编码),N'')=b.仓库编码
       AND ISNULL(RTRIM(i.批号),N'')=ISNULL(RTRIM(b.批号),N''))
)
SELECT COUNT(*) 缺结转行键 FROM x;
