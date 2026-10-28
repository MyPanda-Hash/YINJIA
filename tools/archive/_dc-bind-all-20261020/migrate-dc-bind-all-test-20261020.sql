/* ============================================================================
   设备配置管理 —— 测试账套批量绑定网关(2026-10-20)
   ----------------------------------------------------------------------------
   背景:用户在「设备配置管理」页(测试账套 HSDZ_MES_TEST)看到
         设备总数 129 / 已绑定网关 0 / 网关数量 0,要求「将当前所有都进行完成绑定」:
         ① 已绑定网关 0 → 129;② 列表「网关」列每行的「未绑定」标签变成网关名。

   口径(为什么这么做):
     · 五连检查第一项「绑定网关」的判据 = bs_dc_device.gateway_id 非空
       (DcService#checks,不另存冗余标记),所以「绑定」就是写 gateway_id;
     · 测试库里一间网关都没有(网关数量 0),没有网关就无从绑定 ——
       故先补建一个台账网关 DC-GW-01(占位,地址/端口留空,接硬件时在界面改);
     · 只动「绑定网关」这一项:数采工程 / 绘制组态 / 数采规则 / 数据调试
       仍为 ✗,完成度不变(那是另一件事,需用户确认后再补)。

   🔴 硬闸门:本脚本只允许在 HSDZ_MES_TEST 执行 —— 129 台设备与这条网关
      都是测试演示数据,正式账套 HSDZ_MES 一个字节都不能动。

   执行(在 tools 目录下,JDK 25):
     YINJIA_SQL_DB 用不到,直接指定连接串:
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
       "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" ^
       yinjia <口令> archive\_dc-bind-all-20261020\migrate-dc-bind-all-test-20261020.sql

   幂等:网关按 code 取/建;设备只在 gateway_id 不等于目标网关时更新,重跑 0 行。
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @db sysname = DB_NAME();
IF @db <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR (N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行,当前库=%s。', 16, 1, @db);
  RETURN;
END

DECLARE @gwCode nvarchar(50) = N'DC-GW-01';
DECLARE @gwId   int;
DECLARE @total  int = (SELECT COUNT(1) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');

/* ---------- 1. 网关台账:有就取,没有就建(占位,地址端口留空) ---------- */
SELECT @gwId = id FROM bs_dc_gateway WHERE code = @gwCode AND ISNULL(asp_cancel,'N') <> 'Y';

IF @gwId IS NULL
BEGIN
  INSERT INTO bs_dc_gateway
    (code, name, protocol, host, port, status, enabled, remark, api_key, asp_user1, asp_time1)
  VALUES
    (@gwCode, N'车间数采网关01', N'MQTT', NULL, NULL, N'offline', 'Y',
     N'测试库占位网关:2026-10-20 按用户要求把现有 129 台设备统一绑定到此网关;真实地址/端口待接硬件时在界面维护',
     N'dc-gw-01-demo-2026', N'provision-bind-all', SYSDATETIME());
  SET @gwId = CAST(SCOPE_IDENTITY() AS int);
  PRINT N'[新建] 网关 ' + @gwCode + N' id=' + CAST(@gwId AS nvarchar(10));
END
ELSE
  PRINT N'[已存在] 网关 ' + @gwCode + N' id=' + CAST(@gwId AS nvarchar(10));

/* ---------- 2. 全部设备绑到该网关 ---------- */
DECLARE @bound int;
UPDATE bs_dc_device
   SET gateway_id = @gwId,
       asp_user2  = N'provision-bind-all',
       asp_time2  = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND (gateway_id IS NULL OR gateway_id <> @gwId);
SET @bound = @@ROWCOUNT;
PRINT N'[绑定] 本次更新 ' + CAST(@bound AS nvarchar(10)) + N' 行';

/* ---------- 3. 自检:在册设备 = 已绑定该网关(不等即整批失败) ---------- */
DECLARE @nowBound int = (SELECT COUNT(1) FROM bs_dc_device
                          WHERE ISNULL(asp_cancel,'N') <> 'Y' AND gateway_id IS NOT NULL);
DECLARE @nowGw    int = (SELECT COUNT(1) FROM bs_dc_device
                          WHERE ISNULL(asp_cancel,'N') <> 'Y' AND gateway_id = @gwId);

SELECT N'设备总数'     AS 项目, @total    AS 值
UNION ALL SELECT N'已绑定网关',   @nowBound
UNION ALL SELECT N'绑定到 ' + @gwCode, @nowGw
UNION ALL SELECT N'本次更新行数', @bound;

IF @nowBound <> @total OR @nowGw <> @total
BEGIN
  RAISERROR (N'[自检失败] 设备总数 %d,已绑定 %d,绑定到本网关 %d —— 应立即复查。',
             16, 1, @total, @nowBound, @nowGw);
  RETURN;
END

PRINT N'[OK] 测试账套 129 台设备已全部绑定到 ' + @gwCode;
