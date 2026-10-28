/* ============================================================================
   设备配置管理 —— 测试账套 129 台设备「五连」补齐后四项(2026-10-20)
   ----------------------------------------------------------------------------
   背景:第一脚本(migrate-dc-bind-all-test-20261020.sql)已把 129 台设备绑到
         DC-GW-01,「绑定网关」✓,完成度 20%。用户看着「五连检查」列里剩下的四个 ✗
         说「这些都设定为完成」⇒ 把剩余四项按判据补齐,让 配置齐备 = 129、完成度 = 100%。

   判据(DcService#checks,只看台账字段):
     ① 绑定网关 gateway_id 非空            —— 已由第一脚本完成,本脚本不动
     ② 数采工程 project_code 非空          ← 按设备补 DC-PROJ-<设备编码去横线>
     ③ 绘制组态 scada_drawn = 'Y'          ← 置 Y
     ④ 数采规则 存在启用的 bs_dc_rule      ← 每台设备补一条 enabled='Y' 的「定时采集(默认)」
     ⑤ 数据调试 last_debug_at 非空         ← 等价于界面上的「标记调试完成」按钮

   🔴 硬闸门:只允许在 HSDZ_MES_TEST 执行 —— 129 台设备是测试演示数据,
      正式账套 HSDZ_MES(3 台设备 + 真机 DZ-001)一个字节都不能动。

   执行(在 tools 目录下,JDK 25):
     java -Dstdout.encoding=UTF-8 -cp lib\mssql-jdbc.jar SqlRunner.java ^
       "jdbc:sqlserver://127.0.0.1:1433;databaseName=HSDZ_MES_TEST;encrypt=false;trustServerCertificate=true" ^
       yinjia <口令> archive\_dc-bind-all-20261020\migrate-dc-complete-five-20261020.sql

   幂等:四段都带「已经对了就不动」的条件,重跑更新 0 行、插入 0 行。
   ============================================================================ */
SET NOCOUNT ON;

DECLARE @db sysname = DB_NAME();
IF @db <> N'HSDZ_MES_TEST'
BEGIN
  RAISERROR (N'[拒绝] 本脚本只允许在测试账套 HSDZ_MES_TEST 执行,当前库=%s。', 16, 1, @db);
  RETURN;
END

DECLARE @total int = (SELECT COUNT(1) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @n1 int, @n2 int, @n3 int, @n4 int;

/* ---------- ② 数采工程:每台设备一个工程号,便于回查是哪台 ---------- */
UPDATE bs_dc_device
   SET project_code = N'DC-PROJ-' + REPLACE(code, N'-', N''),
       asp_user2    = N'provision-five',
       asp_time2    = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND ISNULL(project_code,'') = N'';
SET @n1 = @@ROWCOUNT;

/* ---------- ③ 绘制组态:'Y' ---------- */
UPDATE bs_dc_device
   SET scada_drawn = 'Y',
       asp_user2   = N'provision-five',
       asp_time2   = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND ISNULL(scada_drawn,'N') <> 'Y';
SET @n2 = @@ROWCOUNT;

/* ---------- ④ 数采规则:没有启用规则的就补一条默认定时采集 ---------- */
INSERT INTO bs_dc_rule
  (device_id, name, rule_type, expression, params, enabled, remark, asp_user1, asp_time1)
SELECT d.id, N'定时采集(默认)', N'定时采集', NULL,
       N'每 60 秒采集一次;批量登记占位,接硬件后按实际协议/寄存器调整',
       'Y', N'2026-10-20 批量补齐五连时登记', N'provision-five', SYSDATETIME()
  FROM bs_dc_device d
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM bs_dc_rule r
                    WHERE r.device_id = d.id
                      AND ISNULL(r.asp_cancel,'N') <> 'Y'
                      AND r.enabled = 'Y');
SET @n3 = @@ROWCOUNT;

/* ---------- ⑤ 数据调试:等价于界面「标记调试完成」 ---------- */
UPDATE bs_dc_device
   SET last_debug_at = SYSDATETIME(),
       asp_user2     = N'provision-five',
       asp_time2     = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND last_debug_at IS NULL;
SET @n4 = @@ROWCOUNT;

/* ---------- 自检:五连逐项等于设备总数,不等即整批失败 ---------- */
DECLARE @gw    int = (SELECT COUNT(1) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND gateway_id IS NOT NULL);
DECLARE @prj   int = (SELECT COUNT(1) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(project_code,'')<>'');
DECLARE @scada int = (SELECT COUNT(1) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND scada_drawn='Y');
DECLARE @rule  int = (SELECT COUNT(1) FROM bs_dc_device d
                       WHERE ISNULL(d.asp_cancel,'N')<>'Y'
                         AND EXISTS (SELECT 1 FROM bs_dc_rule r
                                      WHERE r.device_id=d.id AND ISNULL(r.asp_cancel,'N')<>'Y' AND r.enabled='Y'));
DECLARE @dbg   int = (SELECT COUNT(1) FROM bs_dc_device WHERE ISNULL(asp_cancel,'N')<>'Y' AND last_debug_at IS NOT NULL);

-- ⚠ 第一个分支决定列类型:int 的类型优先级高于 nvarchar,不显式 CAST 会把后面的中文串
--   往 int 转(2026-10-20 实测报 "Conversion failed when converting the nvarchar value
--   '129 / 129 / 129 / 128' to data type int")。全部 CAST 成 nvarchar 再 UNION。
SELECT N'设备总数'   AS 项目, CAST(@total AS nvarchar(10)) AS 值
UNION ALL SELECT N'① 绑定网关', CAST(@gw    AS nvarchar(10))
UNION ALL SELECT N'② 数采工程', CAST(@prj   AS nvarchar(10))
UNION ALL SELECT N'③ 绘制组态', CAST(@scada AS nvarchar(10))
UNION ALL SELECT N'④ 数采规则', CAST(@rule  AS nvarchar(10))
UNION ALL SELECT N'⑤ 数据调试', CAST(@dbg   AS nvarchar(10))
UNION ALL SELECT N'本次 工程/组态/规则/调试 变更行数',
        CAST(@n1 AS nvarchar(10)) + N' / ' + CAST(@n2 AS nvarchar(10)) + N' / '
      + CAST(@n3 AS nvarchar(10)) + N' / ' + CAST(@n4 AS nvarchar(10));

IF @gw <> @total OR @prj <> @total OR @scada <> @total OR @rule <> @total OR @dbg <> @total
BEGIN
  RAISERROR (N'[自检失败] 五连计数 网关=%d 工程=%d 组态=%d 规则=%d 调试=%d,设备总数=%d —— 应立即复查。',
             16, 1, @gw, @prj, @scada, @rule, @dbg, @total);
  RETURN;
END

PRINT N'[OK] 测试账套五连已全部拉满';
