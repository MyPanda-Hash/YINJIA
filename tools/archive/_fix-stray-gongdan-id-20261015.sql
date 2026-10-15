-- _fix-stray-gongdan-id-20261015.sql  【一次性修复脚本,**不登记进 db-migrations.txt**】
-- 背景:2026-10-15 10:17:42 有一轮 DbSync sync 撞上 migrate-stock-flow-trace-cols-20261015.sql 的
--   **改到一半的文件**(那时文件里还留着 `ADD [工单ID] float`),于是两账套 inh/outh 各被追加了一列
--   `工单ID float`(column_id 59/60,全 NULL),随后该脚本自检报「inh 59 / outh 60」⇒ 脚本 FAIL、sync 中止。
-- 目标态是 `工单项次 int`(58/59 列)、**不留 `工单ID`** ⇒ 本脚本把这次误加的列删掉(可重跑的守卫式删除)。
-- 守卫:仅当「① 工单项次 已存在(说明改名已生效)② 工单ID 存在 ③ 工单ID 全为 NULL
--   ④ 工单ID 上没有默认约束/索引键」四条同时成立才 DROP;任一条不成立只打印警告不动手。
-- 用法(两账套各跑一次;HSDZ_MES_TEST 用 YINJIA_SQL_DB 指定):
--   cd tools && java -cp lib\mssql-jdbc.jar DbSync.java run archive/_fix-stray-gongdan-id-20261015.sql
SET QUOTED_IDENTIFIER ON;
GO
SET ANSI_NULLS ON;
GO
SET NOCOUNT ON;
GO

DECLARE @tbl sysname, @col sysname, @sql nvarchar(400), @n int, @bad int;

DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
  SELECT N'inh' UNION ALL SELECT N'outh';
OPEN cur;
FETCH NEXT FROM cur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @col = N'工单ID';
  IF COL_LENGTH(N'dbo.' + @tbl, N'工单项次') IS NULL
    PRINT N'[SKIP] ' + @tbl + N':工单项次 不存在(不是已改名的老环境)⇒ 不动 工单ID';
  ELSE IF COL_LENGTH(N'dbo.' + @tbl, @col) IS NULL
    PRINT N'[SKIP] ' + @tbl + N'.工单ID 不存在(已是目标态)';
  ELSE
  BEGIN
    -- 守卫 ③:全 NULL 才删(有值就不敢删)
    SET @sql = N'SELECT @n = COUNT(*) FROM dbo.' + QUOTENAME(@tbl) + N' WHERE [工单ID] IS NOT NULL';
    EXEC sp_executesql @sql, N'@n int OUT', @n OUT;
    -- 守卫 ④:没有默认约束、且不是任何索引键列
    SELECT @bad = (SELECT COUNT(*) FROM sys.default_constraints dc
                    JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                   WHERE dc.parent_object_id = OBJECT_ID(N'dbo.' + @tbl) AND c.name = @col)
                + (SELECT COUNT(*) FROM sys.index_columns ic
                    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                   WHERE ic.object_id = OBJECT_ID(N'dbo.' + @tbl) AND c.name = @col);
    IF @n > 0 OR @bad > 0
      RAISERROR(N'[WARN] %s.工单ID 非空行 %d / 约束或索引引用 %d ⇒ 不删除,需人工确认', 10, 1, @tbl, @n, @bad);
    ELSE
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tbl) + N' DROP COLUMN [工单ID]';
      EXEC sp_executesql @sql;
      PRINT N'[FIX] ' + @tbl + N'.工单ID(全 NULL 的误加列)已删除';
    END
  END
  FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur; DEALLOCATE cur;
GO

-- 复核:两表列数应回到 58 / 59,且 工单ID 残留 = 0
DECLARE @cinh int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.inh'));
DECLARE @couth int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.outh'));
DECLARE @res int = (SELECT COUNT(*) FROM sys.columns
                     WHERE object_id IN (OBJECT_ID(N'dbo.inh'), OBJECT_ID(N'dbo.outh')) AND name = N'工单ID');
DECLARE @dbn sysname = DB_NAME();   -- RAISERROR 的替换参数不能直接写函数调用
RAISERROR(N'[复核] %s:inh %d 列 / outh %d 列(应 58/59);工单ID 残留 %d 条(应 0)', 10, 1, @dbn, @cinh, @couth, @res);
IF @cinh <> 58 OR @couth <> 59 OR @res <> 0
  RAISERROR(N'[FAIL] 复核不符:期望 inh 58 / outh 59 列、工单ID 残留 0', 16, 1);
GO
