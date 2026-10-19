/* ============================================================
   migrate-db-backup-20261019.sql
   系统管理平台 · 数据库数据安全(主动备份 / 自动备份)—— 建 1 张表 + 4 个系统参数

   用户口径(2026-10-19):
     "再给系统的系统管理模块加一个面板，面板是可以设置系统的数据库数据的主动备份和
      自动备份的时间的，是系统的一个数据安全的一个功能"

   为什么这样建:
   - **不新建"设置表"**:运行期可调的系统参数统一落在既有 `yj_app_setting`(键值对表,
     收料超送比例等同一套),本功能新增 4 个键:
       db_backup.auto_enabled = 是否启用自动备份(Y/N,默认 N —— 不替用户擅自打开后台任务)
       db_backup.auto_time    = 自动备份时间(HH:mm,默认 02:00 凌晨)
       db_backup.keep_files   = 备份保留份数(默认 14,按份数从旧到新清理)
       db_backup.dir          = 备份目录(SQL Server 服务账号可写的本机目录)
     为什么要人定目录:BACKUP DATABASE 由**数据库引擎**写盘(不是 Java 进程),
     目录必须是 SQL 服务账号有写权限的路径,默认给本机既有的 C:\SQLBackup\YINJIA-MES
     (既有手工备份也在 C:\SQLBackup 下,服务账号已验证可写)。服务器上按实际盘符改。
   - **运行留痕表 `yj_backup_log`**:一次备份一行(手动/自动、成功/失败、文件名、大小、
     耗时、失败原因)。只增不改:备份是数据安全动作,必须可追溯"什么时候备过、备到哪、
     成没成功";前端「备份记录」直接读它,不靠日志文件。
   - 权限:应用连接账号 `yinjia` 需要 `db_backupoperator`(否则 BACKUP DATABASE 报权限不足)。
     下面幂等补一次,失败只打印提示不中断(服务器上账号可能已是 sysadmin/db_owner)。

   幂等:建表/索引/注明/参数种子全部判存在;可重复执行。
   两账套都执行(正式 HSDZ_MES 先、测试 HSDZ_MES_TEST 后),已登记进 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- 1. 备份运行留痕表 ---------- */
IF OBJECT_ID('dbo.yj_backup_log','U') IS NULL
CREATE TABLE dbo.yj_backup_log (
  id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_yj_backup_log PRIMARY KEY,
  run_type      nvarchar(10)   NOT NULL,          -- 手动 / 自动
  status        nvarchar(10)   NOT NULL,          -- 成功 / 失败
  db_name       nvarchar(100)  NULL,
  file_path     nvarchar(400)  NULL,
  file_size_kb  bigint         NULL,
  elapsed_ms    int            NULL,
  started_at    datetime2      NOT NULL CONSTRAINT DF_yj_backup_log_started DEFAULT SYSDATETIME(),
  finished_at   datetime2      NULL,
  message       nvarchar(1000) NULL,
  operator      nvarchar(50)   NULL,
  asp_user1     nvarchar(50)   NULL,
  asp_time1     datetime2      NULL,
  asp_user2     nvarchar(50)   NULL,
  asp_time2     datetime2      NULL
);
GO
IF OBJECT_ID('dbo.yj_backup_log','U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_yj_backup_log_started' AND object_id = OBJECT_ID('dbo.yj_backup_log'))
  CREATE INDEX IX_yj_backup_log_started ON dbo.yj_backup_log(started_at DESC);
GO

/* ---------- 2. 中文注明(表级 + 列级,幂等) ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties WHERE major_id = OBJECT_ID('dbo.yj_backup_log') AND minor_id = 0 AND name = N'MS_Description')
  EXEC sp_addextendedproperty N'MS_Description',
       N'数据库备份留痕:一次备份一行(手动/自动、成功/失败、文件名/大小/耗时/原因;只增不改)',
       N'SCHEMA', N'dbo', N'TABLE', N'yj_backup_log';
GO
DECLARE @c TABLE (col sysname PRIMARY KEY, descr nvarchar(200));
INSERT INTO @c (col, descr) VALUES
 (N'id',          N'主键(自增;一条 = 一次备份执行)'),
 (N'run_type',    N'备份方式(手动=点「立即备份」;自动=按设定时间由后台触发)'),
 (N'status',      N'备份结果(成功/失败)'),
 (N'db_name',     N'被备份的数据库名'),
 (N'file_path',   N'备份文件完整路径(.bak)'),
 (N'file_size_kb',N'备份文件大小(KB)'),
 (N'elapsed_ms',  N'备份耗时(毫秒)'),
 (N'started_at',  N'备份开始时间'),
 (N'finished_at', N'备份结束时间'),
 (N'message',     N'结果说明(成功=文件已生成;失败=数据库返回的错误原文)'),
 (N'operator',    N'操作人(自动备份记 system)'),
 (N'asp_user1',   N'创建人'),
 (N'asp_time1',   N'创建时间'),
 (N'asp_user2',   N'最后修改人'),
 (N'asp_time2',   N'最后修改时间');
DECLARE @col sysname, @d nvarchar(200);
DECLARE cur1 CURSOR FAST_FORWARD LOCAL FOR SELECT col, descr FROM @c;
OPEN cur1; FETCH NEXT FROM cur1 INTO @col, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 JOIN sys.columns cl ON cl.object_id = ep.major_id AND cl.column_id = ep.minor_id
                 WHERE ep.major_id = OBJECT_ID('dbo.yj_backup_log') AND ep.name = N'MS_Description' AND cl.name = @col)
    EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', N'yj_backup_log', N'COLUMN', @col;
  FETCH NEXT FROM cur1 INTO @col, @d;
END
CLOSE cur1; DEALLOCATE cur1;
GO

/* ---------- 3. 系统参数种子(不覆盖人工改过的值) ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_enabled')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'db_backup.auto_enabled', N'N', N'数据库自动备份开关(Y=按下面设定的时间每日备份)', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_time')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'db_backup.auto_time', N'02:00', N'数据库自动备份时间(HH:mm,服务器本地时间;每天该时刻后备份一次)', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.keep_files')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'db_backup.keep_files', N'14', N'数据库备份保留份数(超出后从最旧的开始删除;0 或空=不自动清理)', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.dir')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'db_backup.dir', N'C:\SQLBackup\YINJIA-MES', N'数据库备份目录(SQL Server 服务账号必须可写;服务器上按实际盘符改)', N'migration', SYSDATETIME());
GO

/* ---------- 4. 备份权限(应用连接账号需要 db_backupoperator) ---------- */
BEGIN TRY
  IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'yinjia' AND type IN ('S','U'))
     AND IS_ROLEMEMBER(N'db_backupoperator', N'yinjia') <> 1
     AND IS_ROLEMEMBER(N'db_owner', N'yinjia') <> 1
    ALTER ROLE db_backupoperator ADD MEMBER [yinjia];
  PRINT N'[OK] 备份权限:应用账号 yinjia 具备 db_backupoperator(或已是 db_owner/sysadmin)';
END TRY
BEGIN CATCH
  PRINT N'[WARN] 未补上 db_backupoperator 角色(需 sysadmin 执行):' + ERROR_MESSAGE();
  PRINT N'       服务器部署时请用管理员执行:ALTER ROLE db_backupoperator ADD MEMBER [yinjia];';
END CATCH
GO

/* ---------- 自检 ---------- */
DECLARE @t int = (SELECT COUNT(*) FROM sys.tables WHERE name = N'yj_backup_log');
DECLARE @cols int = (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('dbo.yj_backup_log'));
DECLARE @keys int = (SELECT COUNT(*) FROM dbo.yj_app_setting WHERE setting_key LIKE N'db_backup.%');
IF @t <> 1 OR @cols < 13 OR @keys <> 4
  RAISERROR(N'[FAIL] 备份功能建表/参数未就绪(表 %d、列 %d、参数 %d/4)', 16, 1, @t, @cols, @keys);
DECLARE @noDesc int = (SELECT COUNT(*) FROM sys.columns cl
                        WHERE cl.object_id = OBJECT_ID('dbo.yj_backup_log')
                          AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                                          WHERE ep.major_id = cl.object_id AND ep.minor_id = cl.column_id AND ep.name = N'MS_Description'));
IF @noDesc <> 0 RAISERROR(N'[FAIL] yj_backup_log 仍有 %d 个列缺中文注明', 16, 1, @noDesc);
RAISERROR(N'[OK] 数据库备份功能就绪:yj_backup_log(留痕)+ db_backup.* 4 个参数(默认关闭自动备份)', 10, 1) WITH NOWAIT;
GO
