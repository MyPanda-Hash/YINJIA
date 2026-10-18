SET NOCOUNT ON;
PRINT '=== 从流水重建 kucun(排除月结结转行) ===';
BEGIN TRAN;
IF OBJECT_ID('tempdb..#agg2') IS NOT NULL DROP TABLE #agg2;
SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,
       CAST(SUM(q) AS decimal(18,4)) AS yl,
       CAST(SUM(CASE WHEN q>0 THEN q ELSE 0 END) AS decimal(18,4)) AS cum_in,
       CAST(SUM(CASE WHEN q<0 THEN -q ELSE 0 END) AS decimal(18,4)) AS cum_out
INTO #agg2
FROM (
  SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
  UNION ALL
  SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
) t GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'');

-- 清空 kucun 后按流水重灌(最干净的幂等重建)
DELETE FROM kucun;
INSERT INTO kucun (wzdm,ckdm,lot_no,in_date,rkl,ckl,yl,asp_user1,asp_time1,asp_cancel)
SELECT a.w, a.c, NULLIF(a.l,N''), GETDATE(), a.cum_in, a.cum_out, a.yl, 'rebuild', GETDATE(), 'N'
FROM #agg2 a WHERE a.w <> N'' AND a.c <> N'' AND a.yl <> 0;
COMMIT;
SELECT COUNT(*) 行数, SUM(yl) 合计 FROM kucun;
