SET NOCOUNT ON;
DECLARE @prev nvarchar(7) = LEFT(CONVERT(nvarchar(7), DATEADD(month,-1,GETDATE()), 120), 7);
DECLARE @cur  nvarchar(7) = LEFT(CONVERT(nvarchar(7), GETDATE(), 120), 7);
PRINT N'=== 0 期间 ===';
SELECT @prev AS 上月, @cur AS 当月;

PRINT N'=== 1 月结头 ===';
SELECT id, 期间, 状态, 结转单据编号, CONVERT(nvarchar(10),结转日期,120) 结转日期, 行数, 入库合计, 出库合计, 结存合计,
       CONVERT(nvarchar(19),月结时间,120) 月结时间
FROM bd_stock_close ORDER BY 期间 DESC;

PRINT N'=== 2 月结行表 bl_stock_close 行数 ===';
SELECT 期间, COUNT(*) 行数, SUM(CASE WHEN ISNULL(RTRIM(批号),N'')=N'' THEN 1 ELSE 0 END) 空批号行,
       SUM(结存数量) 结存合计
FROM bl_stock_close GROUP BY 期间 ORDER BY 期间 DESC;

PRINT N'=== 3 结转行 inh(JZ-*) 行数 ===';
SELECT 单据编号, COUNT(*) 行数, SUM(CASE WHEN ISNULL(RTRIM(批号),N'')=N'' THEN 1 ELSE 0 END) 空批号行, SUM(数量) 数量合计
FROM inh WHERE 单据类型 = N'月结结转' GROUP BY 单据编号 ORDER BY 单据编号 DESC;

PRINT N'=== 4 库存明细(kucun) 行数 ===';
SELECT COUNT(*) 行数, SUM(CASE WHEN ISNULL(RTRIM(lot_no),N'')=N'' THEN 1 ELSE 0 END) 空批号行, SUM(yl) 余额合计
FROM kucun;

PRINT N'=== 5 当月有流水、但 bl_stock_close 上月快照里没有的键(抽样) ===';
DECLARE @pStart date = CONVERT(date, @prev + '-01');
DECLARE @pEndEx date = DATEADD(month,1,CONVERT(date, @prev + '-01'));
DECLARE @cStart date = CONVERT(date, @cur + '-01');
DECLARE @cEndEx date = DATEADD(month,1,CONVERT(date, @cur + '-01'));
;WITH flow AS (
  SELECT ISNULL(RTRIM(物料编码),N'') w, ISNULL(RTRIM(仓库编码),N'') c, ISNULL(RTRIM(批号),N'') l FROM inh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
     AND 单据日期 >= @cStart AND 单据日期 < @cEndEx
  UNION ALL
  SELECT ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'') FROM outh
   WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据日期 >= @cStart AND 单据日期 < @cEndEx
)
SELECT TOP 20 f.w 存货, f.c 仓库, f.l 批号,
  (SELECT COUNT(*) FROM bl_stock_close b WHERE b.期间=@prev AND b.物料编码=f.w AND b.仓库编码=f.c AND ISNULL(RTRIM(b.批号),N'')=f.l) 上月快照行数,
  (SELECT COUNT(*) FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
      AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c AND ISNULL(RTRIM(i.批号),N'')=f.l) 上月结转行数
FROM flow f
GROUP BY f.w, f.c, f.l
HAVING (SELECT COUNT(*) FROM inh i WHERE i.单据类型=N'月结结转' AND i.单据编号=N'JZ-'+REPLACE(@prev,'-','')
      AND ISNULL(RTRIM(i.物料编码),N'')=f.w AND ISNULL(RTRIM(i.仓库编码),N'')=f.c AND ISNULL(RTRIM(i.批号),N'')=f.l)=0;
