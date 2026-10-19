/* ============================================================
   _seed-monthly-demo.sql — 演示数据:把「备份记录」改成**每月一次**的历史(仅测试账套)

   用户口径(2026-10-19):「再把现在的已经备份的记录改为每个月备份的，我要用这个去演示」

   做什么:
   - 清掉测试账套里现存的调试记录(今天手点出来的那几条);
   - 按「每月 N 日 02:00 自动备份」的口径补历史,每期一行
     `run_type=自动 / status=成功 / operator=system`,文件名沿用真实命名规则
     `HSDZ_MES_TEST_auto_yyyyMMdd-020000.bak`,大小/耗时给这个库的真实量级(≈67~72 MB / 200~350 ms);
   - **期数口径(2026-10-19 用户两轮)**:先要「每月一次」→ 10 期;**再收窄为「只需要 8 月到 10 月」**
     ⇒ 现为 **3 期**(2026-08-01 / 09-01 / 10-01)。要改期数只动下面 @seed 的月份即可。
   - 保留本月(10-01)一期 ⇒ 自动任务判定「本月已备过」,演示期间不会突然再跑一次(不会多冒一行)。

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

/* 每月 1 日 02:00 的历史 —— 只要 8/9/10 三个月(用户 2026-10-19「只需要8月到10月」) */
DECLARE @seed TABLE (m int, kb bigint, ms int);
INSERT INTO @seed (m, kb, ms) VALUES
 (8, 72118, 261), (9, 72466, 244), (10, 72824, 205);

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
DECLARE @first nvarchar(10) = (SELECT CONVERT(char(7), MIN(started_at), 120) FROM dbo.yj_backup_log);
DECLARE @last nvarchar(10) = (SELECT CONVERT(char(7), MAX(started_at), 120) FROM dbo.yj_backup_log);
IF @after <> 3 OR @auto <> 3 OR @mon <> 3
  RAISERROR(N'[FAIL] 演示记录应为 3 期/3 自动/3 个月,实际 %d/%d/%d', 16, 1, @after, @auto, @mon);
IF @first <> '2026-08' OR @last <> '2026-10'
  RAISERROR(N'[FAIL] 演示记录区间应为 2026-08~2026-10,实际 %s~%s(需求:只需要 8 月到 10 月)', 16, 1, @first, @last);
RAISERROR(N'[OK] 备份记录已改为每月一次:清掉 %d 条旧记录,写入 3 期(2026-08-01 / 09-01 / 10-01,每月 1 日 02:00)',
          10, 1, @before) WITH NOWAIT;
GO
