SET NOCOUNT ON;
-- 复现展开区(detail)取数,对比"修复前 vs 修复后"行数,取样 3 个典型键
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @cur  nvarchar(7) = LEFT(CONVERT(nvarchar(7), GETDATE(), 120), 7);
DECLARE @jz nvarchar(20) = N'JZ-' + REPLACE(@prev,'-','');
DECLARE @pStart date = CONVERT(date, @prev + '-01'), @pEndEx date = DATEADD(month,1,CONVERT(date, @prev + '-01'));
DECLARE @cStart date = CONVERT(date, @cur + '-01'),  @cEndEx date = DATEADD(month,1,CONVERT(date, @cur + '-01'));

PRINT N'=== 三个典型键:①上月有快照②上月0余额新批次本月有货③上月有快照但本月无流水 ===';
;WITH k AS (SELECT TOP 3 wzdm AS w, ISNULL(RTRIM(ckdm),N'') AS c FROM kucun ORDER BY yl DESC)
SELECT k.w, k.c,
  (SELECT COUNT(*) FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
     AND ISNULL(RTRIM(i.物料编码),N'')=k.w AND ISNULL(RTRIM(i.仓库编码),N'')=k.c) AS 修前上月行数,
  (SELECT COUNT(*) FROM (
      SELECT 1 x FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=@jz
         AND ISNULL(RTRIM(i.物料编码),N'')=k.w AND ISNULL(RTRIM(i.仓库编码),N'')=k.c
      UNION ALL
      SELECT 1 FROM inh i WHERE ISNULL(i.asp_cancel,'N')<>'Y' AND ISNULL(i.单据类型,'')<>N'月结结转'
         AND i.单据日期>=@pStart AND i.单据日期<@pEndEx AND ISNULL(RTRIM(i.物料编码),N'')=k.w AND ISNULL(RTRIM(i.仓库编码),N'')=k.c
      UNION ALL
      SELECT 1 FROM outh o WHERE ISNULL(o.asp_cancel,'N')<>'Y'
         AND o.单据日期>=@pStart AND o.单据日期<@pEndEx AND ISNULL(RTRIM(o.物料编码),N'')=k.w AND ISNULL(RTRIM(o.仓库编码),N'')=k.c
   ) t) AS 修后上月行数
FROM k;
