-- 清理 yj_field 孤儿字段:面板声明的列在行表/头表(含视图)中已不存在时删除。
-- 背景:报表视图经多轮重建(报表版↔单据版),字段注册只增不删,残留旧列导致
--       后端按 yj_field 拼 SELECT 时报 207 Invalid column name。幂等,可反复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO
DECLARE @p sysname, @lt sysname, @ht sysname, @n int = 0, @total int = 0;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR
  SELECT panel_code, line_table, ISNULL(head_table, '') FROM yj_panel;
OPEN c; FETCH NEXT FROM c INTO @p, @lt, @ht;
WHILE @@FETCH_STATUS = 0 BEGIN
  DELETE FROM yj_field
  WHERE panel_code = @p
    AND col_name NOT IN (SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(@lt))
    AND (@ht = '' OR col_name NOT IN (SELECT c.name FROM sys.columns c WHERE c.object_id = OBJECT_ID(@ht)));
  SET @n = @@ROWCOUNT; SET @total += @n;
  IF @n > 0 PRINT N'清理 ' + @p + N': ' + CAST(@n AS nvarchar(10)) + N' 个孤儿字段';
  FETCH NEXT FROM c INTO @p, @lt, @ht;
END
CLOSE c; DEALLOCATE c;
PRINT N'孤儿字段清理完成,共删除 ' + CAST(@total AS nvarchar(10)) + N' 行';
GO
