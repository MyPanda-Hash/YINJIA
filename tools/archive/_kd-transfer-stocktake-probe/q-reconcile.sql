SET NOCOUNT ON;
PRINT '=== 重建前基线 ===';
SELECT (SELECT COUNT(*) FROM kucun) 行数, (SELECT SUM(yl) FROM kucun) 合计;
DECLARE @agg nvarchar(max) = N'
SELECT ISNULL(RTRIM(物料编码),N'''') AS w, ISNULL(RTRIM(仓库编码),N'''') AS c, ISNULL(RTRIM(批号),N'''') AS l,
       CAST(SUM(q) AS decimal(18,4)) AS yl,
       CAST(SUM(CASE WHEN q>0 THEN q ELSE 0 END) AS decimal(18,4)) AS cum_in,
       CAST(SUM(CASE WHEN q<0 THEN -q ELSE 0 END) AS decimal(18,4)) AS cum_out
FROM ( SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh WHERE ISNULL(asp_cancel,''N'') <> ''Y'' AND ISNULL(单据类型,'''') <> N''月结结转''
       UNION ALL
       SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh WHERE ISNULL(asp_cancel,''N'') <> ''Y'' ) t
GROUP BY ISNULL(RTRIM(物料编码),N''''), ISNULL(RTRIM(仓库编码),N''''), ISNULL(RTRIM(批号),N'''')';
BEGIN TRAN;
DECLARE @upd int, @ins int;
EXEC sp_executesql N'UPDATE k SET rkl = a.cum_in, ckl = a.cum_out, yl = a.yl, update_date = GETDATE(), asp_user2 = ''lotfix'', asp_time2 = GETDATE()
FROM kucun k JOIN (' + @agg + N') a ON a.w = k.wzdm AND a.c = ISNULL(RTRIM(k.ckdm),N'''') AND a.l = ISNULL(RTRIM(k.lot_no),N'''')
WHERE a.w <> N'''' AND a.c <> N''''';
SET @upd = @@ROWCOUNT;
EXEC sp_executesql N'INSERT INTO kucun (wzdm,ckdm,lot_no,in_date,rkl,ckl,yl,asp_user1,asp_time1,asp_cancel)
SELECT a.w, a.c, NULLIF(a.l,N''''), GETDATE(), a.cum_in, a.cum_out, a.yl, ''lotfix'', GETDATE(), ''N''
FROM (' + @agg + N') a WHERE a.w <> N'''' AND a.c <> N'''' AND a.yl <> 0
  AND NOT EXISTS (SELECT 1 FROM kucun k WHERE k.wzdm=a.w AND ISNULL(RTRIM(k.ckdm),N'''')=a.c AND ISNULL(RTRIM(k.lot_no),N'''')=a.l)';
SET @ins = @@ROWCOUNT;
PRINT ' 更新行: ' + CAST(@upd AS varchar) + ' 新增行: ' + CAST(@ins AS varchar);
COMMIT;
SELECT (SELECT COUNT(*) FROM kucun) 行数, (SELECT SUM(yl) FROM kucun) 合计;
