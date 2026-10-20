/* ============================================================
   migrate-db-backup-monthly-20261019.sql
   数据库自动备份:由「每天一次」改为「每月一次」(配一个月内日期)

   用户口径(2026-10-19,接上一条备份功能):
     "里面显示的数据库备份记录改为每个月一次"

   为什么要单独一个脚本(而不是改 migrate-db-backup-20261019.sql 的字节):
   改历史脚本的字节会让 DbSync 按内容哈希判成"内容变了"而**重跑整条脚本**
   (本脚本幂等,重跑也不炸,但会白白刷一遍日志并让迁移链时间线失真);
   新的口径 = 新脚本,历史脚本保持当时事实。

   改了什么:
   - 新增参数 `db_backup.auto_day`(每月几号,1~28;默认 1 号)—— 29~31 号在 2 月不存在,
     程序里会兜底成"当月最后一天",但让用户选 1~28 更直观、日期不漂移;
   - `db_backup.auto_time` 的备注改成「每月该日 HH:mm」的口径(值不动,默认仍 02:00);
   - `db_backup.auto_enabled` 默认仍是 N(不替用户擅自打开后台任务)。

   判定口径(代码在 DbBackupService.autoTick):
     启用 + 现在 ≥ 本月「auto_day 日 auto_time」 + 本月还没有成功自动备份 ⇒ 跑一次。
   即"一个月最多一次";本月该日没开机,本月内起来会补一次。

   幂等:判存在再插/再改;两账套均执行,已登记 tools/db-migrations.txt。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

IF EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_enabled')
  UPDATE dbo.yj_app_setting
     SET remark = N'数据库自动备份开关(Y=按下面设定的「每月几号」与时间自动备份,一个月一次)',
         asp_time2 = SYSDATETIME()
   WHERE setting_key = N'db_backup.auto_enabled';
GO

IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_day')
  INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
  VALUES (N'db_backup.auto_day', N'1', N'数据库自动备份日期(每月几号,1~28;默认 1 号)', N'migration', SYSDATETIME());
ELSE
  UPDATE dbo.yj_app_setting
     SET remark = N'数据库自动备份日期(每月几号,1~28;默认 1 号)', asp_time2 = SYSDATETIME()
   WHERE setting_key = N'db_backup.auto_day';
GO

IF EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_time')
  UPDATE dbo.yj_app_setting
     SET remark = N'数据库自动备份时间(HH:mm,服务器本地时间;与 db_backup.auto_day 合成"每月几号几点")',
         asp_time2 = SYSDATETIME()
   WHERE setting_key = N'db_backup.auto_time';
GO

/* ---------- 自检 ---------- */
DECLARE @keys int = (SELECT COUNT(*) FROM dbo.yj_app_setting WHERE setting_key LIKE N'db_backup.%');
DECLARE @day nvarchar(10) = (SELECT setting_value FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_day');
DECLARE @time nvarchar(10) = (SELECT setting_value FROM dbo.yj_app_setting WHERE setting_key = N'db_backup.auto_time');
IF @keys <> 5 RAISERROR(N'[FAIL] db_backup.* 参数应为 5 个,实际 %d 个', 16, 1, @keys);
IF @day NOT IN (N'1',N'2',N'3',N'4',N'5',N'6',N'7',N'8',N'9',N'10',N'11',N'12',N'13',N'14',N'15',N'16',N'17',N'18',N'19',N'20',N'21',N'22',N'23',N'24',N'25',N'26',N'27',N'28')
  RAISERROR(N'[FAIL] db_backup.auto_day 取值应为 1~28,实际 = %s', 16, 1, @day);
-- ⚠ RAISERROR 的替换参数不能写表达式/子查询(只能变量或字面量),故上面先取进 @time(2026-10-19 踩过一次)
RAISERROR(N'[OK] 自动备份改为每月一次:db_backup.auto_day = %s 号,auto_time = %s(共 5 个备份参数)',
          10, 1, @day, @time) WITH NOWAIT;
GO
