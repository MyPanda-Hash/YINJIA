/* migrate-kucun-recalc-to-now-20261016.sql — 把 kucun(库存明细结存缓存)按流水重算到今日(一次性对账)
 *
 * 【为什么】核查四表时发现:①/②(库存状况表/台账,读流水)Σ = 4,493,375.07,
 *   而 ④ 库存明细(kucun)Σ = 4,659,205.77,逐 (仓库,存货) 有 391 个键不一致。
 *   根因:kucun 只由**审核钩子**(逐笔)与**月结重算**(重算到期末 9/30)维护;
 *   近期有一批流水是**直接灌入的**(期初导入/造数),没走钩子、也不在月结区间内 ⇒ kucun 落后。
 *   本脚本把 kucun 按**全部流水**(单据日期 < 明天)重算一遍 —— 与月结里的 reconcileKucun 同口径同语句,
 *   只是把截止点从"期末"改成"今天"。
 * 【口径】结转行(月结结转)不计入;rkl/ckl = 累计入/出;yl = 入 − 出;作废行不动。
 * 【幂等】重算是幂等的(同输入同输出);两账套都执行。
 */
SET NOCOUNT ON;
DECLARE @end datetime = DATEADD(day, 1, CAST(GETDATE() AS date));
DECLARE @agg nvarchar(max) = N'
SELECT ISNULL(RTRIM(物料编码),N'''') AS w, ISNULL(RTRIM(仓库编码),N'''') AS c, ISNULL(RTRIM(批号),N'''') AS l,
       CAST(SUM(q) AS decimal(18,4)) AS yl,
       CAST(SUM(CASE WHEN q > 0 THEN q ELSE 0 END) AS decimal(18,4)) AS cum_in,
       CAST(SUM(CASE WHEN q < 0 THEN -q ELSE 0 END) AS decimal(18,4)) AS cum_out
FROM (
  SELECT 物料编码, 仓库编码, 批号, 数量 AS q FROM inh
   WHERE ISNULL(asp_cancel,''N'') <> ''Y'' AND ISNULL(单据类型,'''') <> N''月结结转'' AND 单据日期 < @e
  UNION ALL
  SELECT 物料编码, 仓库编码, 批号, -数量 FROM outh
   WHERE ISNULL(asp_cancel,''N'') <> ''Y'' AND 单据日期 < @e
) t GROUP BY ISNULL(RTRIM(物料编码),N''''), ISNULL(RTRIM(仓库编码),N''''), ISNULL(RTRIM(批号),N'''')';
DECLARE @sql nvarchar(max) = N'
UPDATE k SET rkl = a.cum_in, ckl = a.cum_out, yl = a.yl, update_date = GETDATE(),
             asp_user2 = N''recalc:20261016'', asp_time2 = GETDATE()
FROM kucun k JOIN (' + @agg + N') a
  ON a.w = k.wzdm AND a.c = ISNULL(RTRIM(k.ckdm),N'''') AND a.l = ISNULL(RTRIM(k.lot_no),N'''')
WHERE a.w <> N'''' AND a.c <> N'''';
DECLARE @u int = @@ROWCOUNT;
INSERT INTO kucun (wzdm, ckdm, lot_no, in_date, rkl, ckl, yl, asp_user1, asp_time1, asp_cancel)
SELECT a.w, a.c, NULLIF(a.l, N''''), GETDATE(), a.cum_in, a.cum_out, a.yl, N''recalc:20261016'', GETDATE(), ''N''
FROM (' + @agg + N') a
WHERE a.w <> N'''' AND a.c <> N'''' AND a.yl <> 0
  AND NOT EXISTS (SELECT 1 FROM kucun k WHERE k.wzdm = a.w AND ISNULL(RTRIM(k.ckdm),N'''') = a.c AND ISNULL(RTRIM(k.lot_no),N'''') = a.l);
DECLARE @i int = @@ROWCOUNT;
PRINT N''[重算] 更新 '' + CAST(@u AS nvarchar(10)) + N'' 行 / 新增 '' + CAST(@i AS nvarchar(10)) + N'' 行'';
';
EXEC sp_executesql @sql, N'@e datetime', @e = @end;
GO
DECLARE @bad int = 0;
DECLARE @kc decimal(18,4) = (SELECT CAST(SUM(ISNULL(yl,0)) AS decimal(18,4)) FROM kucun);
DECLARE @flow decimal(18,4) = (SELECT CAST(SUM(q) AS decimal(18,4)) FROM (
   SELECT 数量 AS q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' AND ISNULL(RTRIM(物料编码),N'')<>N'' AND ISNULL(RTRIM(仓库编码),N'')<>N''
   UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(RTRIM(物料编码),N'')<>N'' AND ISNULL(RTRIM(仓库编码),N'')<>N'') t);
IF ABS(@kc - @flow) > 0.0001 SET @bad = @bad + 1;
DECLARE @dbn sysname = DB_NAME();
DECLARE @kcS nvarchar(30) = CAST(@kc AS nvarchar(30));
DECLARE @flS nvarchar(30) = CAST(@flow AS nvarchar(30));
DECLARE @dfS nvarchar(30) = CAST(@kc - @flow AS nvarchar(30));
RAISERROR(N'[自检] %s:kucun Σyl = %s ;流水真值(同键范围) = %s ;差 = %s ;不符项 %d 条', 10, 1, @dbn, @kcS, @flS, @dfS, @bad);
IF @bad = 0 RAISERROR(N'[OK] kucun 已按流水重算到今日,与流水口径一致', 10, 1);
ELSE RAISERROR(N'[WARN] kucun 与流水仍有差额(见上,多为批号体系错位所致)', 10, 1);
GO