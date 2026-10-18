SET NOCOUNT ON;
BEGIN TRAN;

-- 视图:按流水(除月结结转)聚合到 (物料,仓库,批号) 三键
IF OBJECT_ID('tempdb..#agg') IS NOT NULL DROP TABLE #agg;
SELECT ISNULL(RTRIM(物料编码),N'') AS w, ISNULL(RTRIM(仓库编码),N'') AS c, ISNULL(RTRIM(批号),N'') AS l,
       CAST(SUM(q) AS decimal(18,4)) AS yl,
       CAST(SUM(CASE WHEN q>0 THEN q ELSE 0 END) AS decimal(18,4)) AS cum_in,
       CAST(SUM(CASE WHEN q<0 THEN -q ELSE 0 END) AS decimal(18,4)) AS cum_out
INTO #agg
FROM (
  SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y' AND ISNULL(单据类型,'') <> N'月结结转'
  UNION ALL
  SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
) t
GROUP BY ISNULL(RTRIM(物料编码),N''), ISNULL(RTRIM(仓库编码),N''), ISNULL(RTRIM(批号),N'');

DECLARE @upd int, @ins int;
UPDATE k SET rkl = a.cum_in, ckl = a.cum_out, yl = a.yl, update_date = GETDATE(), asp_user2 = 'lotfix', asp_time2 = GETDATE()
FROM kucun k JOIN #agg a ON a.w = k.wzdm AND a.c = ISNULL(RTRIM(k.ckdm),N'') AND a.l = ISNULL(RTRIM(k.lot_no),N'')
WHERE a.w <> N'' AND a.c <> N'';
SET @upd = @@ROWCOUNT;

INSERT INTO kucun (wzdm,ckdm,lot_no,in_date,rkl,ckl,yl,asp_user1,asp_time1,asp_cancel)
SELECT a.w, a.c, NULLIF(a.l,N''), GETDATE(), a.cum_in, a.cum_out, a.yl, 'lotfix', GETDATE(), 'N'
FROM #agg a
WHERE a.w <> N'' AND a.c <> N'' AND a.yl <> 0
  AND NOT EXISTS (SELECT 1 FROM kucun k WHERE k.wzdm=a.w AND ISNULL(RTRIM(k.ckdm),N'')=a.c AND ISNULL(RTRIM(k.lot_no),N'')=a.l);
SET @ins = @@ROWCOUNT;
PRINT '更新行=' + CAST(@upd AS varchar) + ' 新增行=' + CAST(@ins AS varchar);

-- 孤儿行:新口径下三键不在 #agg 里的,清零
UPDATE k SET yl = 0, rkl = 0, ckl = 0, asp_user2='lotfix-orphan', asp_time2=GETDATE()
FROM kucun k WHERE NOT EXISTS (SELECT 1 FROM #agg a WHERE a.w=k.wzdm AND a.c=ISNULL(RTRIM(k.ckdm),N'') AND a.l=ISNULL(RTRIM(k.lot_no),N''));
PRINT '孤儿清零行=' + CAST(@@ROWCOUNT AS varchar);
COMMIT;
SELECT (SELECT COUNT(*) FROM kucun) 行数, (SELECT SUM(yl) FROM kucun) 合计;
