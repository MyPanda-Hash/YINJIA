/* ============================================================
   _seed-monthly-demo.sql — 演示数据:把「备份记录」改成**每月一次**的历史(仅测试账套)

   用户口径(2026-10-19):「再把现在的已经备份的记录改为每个月备份的，我要用这个去演示」

   做什么:
   - 清掉测试账套里现存的几条调试记录(今天手点出来的 4 条:3 手动 + 1 自动);
   - 按「每月 N 日 02:00 自动备份」的口径,补 **10 期**历史(2026-01-01 … 2026-10-01),
     每期一行 `run_type=自动 / status=成功 / operator=system`,文件名沿用真实命名规则
     `HSDZ_MES_TEST_auto_yyyyMMdd-020000.bak`,大小/耗时给这个库的真实量级(≈71~73 MB / 200~400 ms)。
   - 保留本月已有一期 ⇒ 自动任务判定「本月已备过」,演示期间不会突然再跑一次(不会冒出第 11 行)。

   安全边界:
   - **只在 HSDZ_MES_TEST 执行**(正式账套不许有演示数据;库名不符直接 RETURN);
   - 只动 `yj_backup_log`(备份留痕,本就没有业务含义),**不碰任何业务表**;
   - ⚠ 这些是**记录行**,对应的 .bak 文件并不在磁盘上(演示看的是页面记录;别拿路径去恢复)。

   执行(在 tools 目录):
     YINJIA_SQL_DB=HSDZ_MES_TEST java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar \
       DbSync.java run archive/_db-backup-20261019/_seed-monthly-demo.sql
   撤回:DELETE FROM yj_backup_log; 然后正常点「立即备份」即可重新长出真实记录。
   ============================================================ */
SET NOCOUNT ON;
GO

IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
  PRINT N'[SKIP] 演示数据只写测试账套 HSDZ_MES_TEST,当前库 = ' + DB_NAME();
  RETURN;
END

DECLARE @before int = (SELECT COUNT(*) FROM dbo.yj_backup_log);
DELETE FROM dbo.yj_backup_log;

/* 每月 1 日 02:00 的 10 期历史(2026-01 ~ 2026-10);大小/耗时按实测 71~73 MB / 200~400 ms 给 */
DECLARE @seed TABLE (m int, kb bigint, ms int);
INSERT INTO @seed (m, kb, ms) VALUES
 (1, 68214, 268), (2, 68930, 254), (3, 69512, 301), (4, 70146, 233),
 (5, 70880, 287), (6, 71240, 219), (7, 71702, 342), (8, 72118, 261),
 (9, 72466, 244), (10, 72824, 205);

DECLARE @m int, @kb bigint, @ms int, @at datetime2, @stamp nvarchar(20), @path nvarchar(400), @msg nvarchar(600);
DECLARE cur CURSOR FAST_FORWARD LOCAL FOR SELECT m, kb, ms FROM @seed ORDER BY m;
OPEN cur; FETCH NEXT FROM cur INTO @m, @kb, @ms;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @at    = DATETIME2FROMPARTS(2026, @m, 1, 2, 0, 0, 0, 3);
  SET @stamp = CONVERT(nvarchar(20), @at, 112) + N'-020000';
  SET @path  = N'C:\SQLBackup\YINJIA-MES\HSDZ_MES_TEST_auto_' + @stamp + N'.bak';
  SET @msg   = N'备份文件已生成:' + @path;
  INSERT INTO dbo.yj_backup_log
    (run_type, status, db_name, file_path, file_size_kb, elapsed_ms, started_at, finished_at,
     message, operator, asp_user1, asp_time1)
  VALUES (N'自动', N'成功', N'HSDZ_MES_TEST', @path, @kb, @ms,
          @at, DATEADD(MILLISECOND, @ms, @at), @msg, N'system', N'seed-demo', SYSDATETIME());
  FETCH NEXT FROM cur INTO @m, @kb, @ms;
END
CLOSE cur; DEALLOCATE cur;

DECLARE @after int = (SELECT COUNT(*) FROM dbo.yj_backup_log);
DECLARE @auto int = (SELECT COUNT(*) FROM dbo.yj_backup_log WHERE run_type = N'自动' AND status = N'成功');
DECLARE @mon int = (SELECT COUNT(DISTINCT CONVERT(char(7), started_at, 120)) FROM dbo.yj_backup_log);
IF @after <> 10 OR @auto <> 10 OR @mon <> 10
  RAISERROR(N'[FAIL] 演示记录应为 10 期/10 自动/10 个月,实际 %d/%d/%d', 16, 1, @after, @auto, @mon);
RAISERROR(N'[OK] 备份记录已改为每月一次:清掉 %d 条旧记录,写入 10 期(2026-01-01 ~ 2026-10-01,每月 1 日 02:00)',
          10, 1, @before) WITH NOWAIT;
GO
