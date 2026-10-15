/* migrate-lot-normalize-doc-lines.sql — 单据明细行的「空批次号」也归一化为 PC0000(补齐上一次漏改的单据侧)
 *
 * 【为什么】2026-10-15 真实测试暴露:`弃审` 一张历史出库单报 `冲回失败:台账无该行(物料 X 批 null)` ——
 *   冲回要按**单据行上的批号**去找 kucun(台账)那一行;而上一次 migrate-lot-normalize-blank-to-pc0000.sql
 *   只把**流水**(inh/outh)的空批号改成了 PC0000,**单据明细行**(bl_*)仍是 NULL/空 ⇒ 找不到台账行。
 *   用户口径本来也是「出库单明细行应有批次号」⇒ 单据行一并归一化,两侧口径一致。
 * 【范围】所有带 `批号` 列、以 bl_ 开头的行表(单据明细);值 NULL/空/'未填批号' 一律写 PC0000。
 *   只动批号一列,不动数量/金额/日期。幂等。两账套都执行。
 */
SET NOCOUNT ON;
DECLARE @t sysname, @sql nvarchar(max), @n int, @total int = 0;
DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
   WHERE c.name = N'批号' AND t.name LIKE N'bl[_]%' ORDER BY t.name;
OPEN cur FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'UPDATE ' + QUOTENAME(@t) + N' SET 批号 = N''PC0000'' WHERE 批号 IS NULL OR LTRIM(RTRIM(批号)) IN (N'''', N''未填批号'')';
  EXEC sp_executesql @sql, N'@n int OUTPUT', @n OUTPUT;
  IF @n > 0 PRINT N'  ' + @t + N' 归一化 ' + CAST(@n AS nvarchar(10)) + N' 行';
  SET @total = @total + @n;
  FETCH NEXT FROM cur INTO @t;
END
CLOSE cur DEALLOCATE cur;
-- 流水侧也补上「未填批号」这种非空占位值
UPDATE inh SET 批号 = N'PC0000' WHERE LTRIM(RTRIM(ISNULL(批号, N''))) = N'未填批号';
UPDATE outh SET 批号 = N'PC0000' WHERE LTRIM(RTRIM(ISNULL(批号, N''))) = N'未填批号';
PRINT N'[归一化] 单据明细行合计 ' + CAST(@total AS nvarchar(10)) + N' 行';
GO
DECLARE @left int = 0;
DECLARE @t2 sysname, @sql2 nvarchar(max);
DECLARE cur2 CURSOR LOCAL FAST_FORWARD FOR
  SELECT t.name FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id
   WHERE c.name = N'批号' AND t.name LIKE N'bl[_]%' ORDER BY t.name;
OPEN cur2 FETCH NEXT FROM cur2 INTO @t2;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql2 = N'SELECT @c = COUNT(*) FROM ' + QUOTENAME(@t2) + N' WHERE 批号 IS NULL OR LTRIM(RTRIM(批号)) IN (N'''', N''未填批号'')';
  EXEC sp_executesql @sql2, N'@c int OUTPUT', @left OUTPUT;
  IF @left > 0 BREAK;
  FETCH NEXT FROM cur2 INTO @t2;
END
CLOSE cur2 DEALLOCATE cur2;
DECLARE @dbn sysname = DB_NAME();
DECLARE @inhLeft int = (SELECT COUNT(*) FROM inh WHERE 批号 IS NULL OR LTRIM(RTRIM(批号)) = N'');
DECLARE @outhLeft int = (SELECT COUNT(*) FROM outh WHERE 批号 IS NULL OR LTRIM(RTRIM(批号)) = N'');
RAISERROR(N'[自检] %s:单据行残留空批号 %d 行(应 0);流水残留 inh %d / outh %d(应 0)', 10, 1, @dbn, @left, @inhLeft, @outhLeft);
IF @left = 0 AND @inhLeft = 0 AND @outhLeft = 0
  RAISERROR(N'[OK] 单据行与流水的批次号已一致(弃审可正常冲回)', 10, 1);
ELSE RAISERROR(N'[FAIL] 仍有空批次号', 16, 1);
GO