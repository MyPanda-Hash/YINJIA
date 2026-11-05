/* ============================================================================
   migrate-print-station-20261104.sql — 自动打印改「按电脑 + 按打印类型」的配置迁移

   【背景】用户 2026-11-04 口径:
     「现在的自动打印有问题……我是想要设置的电脑开启自动打印,没有设置的电脑就不开启,
      但是在服务器上开启是固定的。能不能在自动打印的面版加个参数来限定电脑。
      还有我想加个勾选打印类型的。现在自动打印只有生产领料单。」

   【改了什么】
   旧版只有一个**全局**开关 `print.auto_enabled`(一台电脑点一下、所有电脑一起开/关)。
   新版改成**每台打印电脑一个站点**,配置写在系统参数表里:
       print.station.<站点名>.enabled   = Y / N
       print.station.<站点名>.types     = PICK_SLIP(逗号分隔的类型 code)
   站点名 = 打印代理启动参数 `-Station` 的那个名字(代理每 4 秒 `/pending?station=<站点名>`)。
   没配置过的站点**默认关闭** —— 正是用户要的「没有设置的电脑就不开启」。

   【本脚本做什么】
   把**现有那台打印电脑**的配置补出来,保证升级后现场不用先配一次就能继续打印:
   旧代码每次心跳都会把代理的站点名写进 `print.station_name`(运维展示用),
   这里就按那个名字补一条「开 + 生产领料单」。

   ⚠ 为什么必须补:`print.station_name` 为空 = 从来没跑过打印代理 = 本来就不打印,
   这时**不补**(保持"没设置的不开");有值说明现场那台机器在跑代理,补上才不打断生产。

   【幂等】已存在的键不覆盖(人工改过的开关/类型优先)。
   【账套】正式库 + 测试库都要跑(见 AGENTS「两账套纪律」)。
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @station nvarchar(200);
DECLARE @enabledKey nvarchar(100);
DECLARE @typesKey nvarchar(100);

SELECT TOP 1 @station = LTRIM(RTRIM(ISNULL(setting_value, N'')))
  FROM dbo.yj_app_setting
 WHERE setting_key = N'print.station_name';

IF ISNULL(@station, N'') = N''
BEGIN
    PRINT N'[SKIP] print.station_name 为空:没有跑过打印代理,不补站点配置(保持"没设置的不开")';
END
ELSE IF LEN(@station) > 70
BEGIN
    -- setting_key 是 nvarchar(100),前缀 print.station. + 后缀 .enabled/.types 要占 24 个字符
    PRINT N'[SKIP] 站点名过长(>70 字),无法落进 yj_app_setting.setting_key:请把代理的 -Station 改短';
END
ELSE
BEGIN
    SET @enabledKey = N'print.station.' + @station + N'.enabled';
    SET @typesKey   = N'print.station.' + @station + N'.types';

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = @enabledKey)
        INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
        VALUES (@enabledKey, N'Y',
                N'打印站点「' + @station + N'」的自动打印开关(Y=这台电脑出纸,N=不出)',
                N'migrate-print-station-20261104', SYSDATETIME());
    ELSE
        PRINT N'[SKIP] 已存在 ' + @enabledKey + N'(保留现网设置)';

    IF NOT EXISTS (SELECT 1 FROM dbo.yj_app_setting WHERE setting_key = @typesKey)
        INSERT INTO dbo.yj_app_setting (setting_key, setting_value, remark, asp_user1, asp_time1)
        VALUES (@typesKey, N'PICK_SLIP',
                N'打印站点「' + @station + N'」勾选的打印类型(逗号分隔的 code;PICK_SLIP=生产领料单)',
                N'migrate-print-station-20261104', SYSDATETIME());
    ELSE
        PRINT N'[SKIP] 已存在 ' + @typesKey + N'(保留现网设置)';

    -- 旧全局开关已不参与分发,把 remark 写清楚,免得运维还以为要在这里开
    UPDATE dbo.yj_app_setting
       SET remark = N'【已停用】旧全局自动打印开关:2026-11-04 起改为按站点的开关,本键不再参与分发'
     WHERE setting_key = N'print.auto_enabled'
       AND ISNULL(remark, N'') NOT LIKE N'【已停用】%';

    PRINT N'[OK] 站点「' + @station + N'」:开 + 生产领料单(PICK_SLIP)';
END

-- ── 自检 ──────────────────────────────────────────────────────────────
DECLARE @bad int = 0;

SELECT @bad = COUNT(*) FROM dbo.yj_app_setting
 WHERE setting_key LIKE N'print.station.%.enabled'
   AND setting_value NOT IN (N'Y', N'N');
IF @bad > 0
BEGIN
    RAISERROR(N'[FAIL] 有 %d 行 print.station.*.enabled 不是 Y/N', 16, 1, @bad);
END

SELECT @bad = COUNT(*) FROM dbo.yj_app_setting
 WHERE setting_key LIKE N'print.station.%.types'
   AND setting_value NOT IN (N'', N'PICK_SLIP');
IF @bad > 0
BEGIN
    RAISERROR(N'[FAIL] 有 %d 行 print.station.*.types 出现了未注册的类型 code', 16, 1, @bad);
END

SELECT setting_key, setting_value FROM dbo.yj_app_setting
 WHERE setting_key LIKE N'print.%' ORDER BY setting_key;

PRINT N'[PASS] migrate-print-station-20261104 完成(幂等,可重复执行)';
