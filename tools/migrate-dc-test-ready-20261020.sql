/* ============================================================
   migrate-dc-test-ready-20261020.sql
   测试账套:把数采设备全部置为「五连齐备（可用）」状态,用于演示/试用

   用户口径(2026-10-20,附图标注):
     「现在把测试账套的设备全部改为可用的状态」
     图里圈了两处:① KPI「已绑定网关 0」→ 改为 129;② 设备表「未绑定」→ 改为「已绑定」
     (并清掉「未完成 129 / 配置齐备 0」这种"全红"的演示尴尬)。

   口径(五连 = 页面「设备五连检查」的 5 项,判据见 DcService.checks):
     ① 绑定网关   → device.gateway_id 非空(指向一个启用的网关)
     ② 数采工程   → device.project_code 非空
     ③ 绘制组态   → device.scada_drawn = 'Y'
     ④ 数采规则   → 存在 enabled='Y' 的 bs_dc_rule(每台补 1 条)
     ⑤ 数据调试   → device.last_debug_at 非空(等价于人工点「标记调试完成」,无硬件先登记)
   另:每台补 1 个采集点(bs_dc_point),让「采集点」列不是 0(演示更真实)。

   ⚠ 只改**配置可用性**,不伪造在线:
     device.status / last_seen_at **不动** —— 这些设备没接硬件,真实就是离线。
     「可用」= 配置齐备(五连),不等于「在线」(靠网关真实上报心跳)。要看在线得接硬件或走
     `/api/dc/ingest` 真实上报。

   ⚠ 只动测试账套(用户口径「测试账套」):闸门 + 全部 UPDATE/INSERT 写在同一批里,
     正式库上下文只打印一行提示、不写任何行(教训见 migrate-dc-device-import-20261019.sql 头注释:
     T-SQL 的 RETURN 只结束当前批,闸门与写语句之间不能插 GO)。
   ⚠ 幂等:网关/采集点/规则都按存在性判断;设备 UPDATE 只碰"还没配齐"的行。
   ⚠ 已作废设备(asp_cancel='Y')一律不碰 —— 它们不在页面统计口径里。
   ============================================================ */
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.bs_dc_device','U') IS NULL OR OBJECT_ID('dbo.bs_dc_gateway','U') IS NULL
BEGIN
  PRINT N'[SKIP] 本库没有数采平台表,无需处理';
  RETURN;
END
IF DB_NAME() <> N'HSDZ_MES_TEST'
BEGIN
  PRINT N'[SKIP] 本脚本只针对测试账套 HSDZ_MES_TEST,当前库 = ' + DB_NAME();
  RETURN;
END

/* ---------- ① 确保有一个启用的演示网关 ---------- */
DECLARE @gwId int = (SELECT TOP 1 id FROM dbo.bs_dc_gateway
                      WHERE code = N'GW-READY' AND ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id);
IF @gwId IS NULL
BEGIN
  INSERT INTO dbo.bs_dc_gateway (code, name, protocol, host, port, status, last_seen_at, enabled, remark,
                                 asp_user1, asp_time1)
  VALUES (N'GW-READY', N'演示网关（配置齐备）', N'HTTP', N'127.0.0.1', 8090, N'offline', NULL, 'Y',
          N'2026-10-20 由 migrate-dc-test-ready 建:仅用于让测试账套设备通过「绑定网关」检查,无真实硬件',
          N'system', SYSDATETIME());
  SET @gwId = SCOPE_IDENTITY();
END

/* ---------- ② 设备:绑定网关 / 数采工程 / 组态 / 调试通过 ---------- */
DECLARE @devDone int = 0;
UPDATE dbo.bs_dc_device
   SET gateway_id     = ISNULL(gateway_id, @gwId),
       project_code   = CASE WHEN ISNULL(project_code, N'') = N'' THEN N'DC-DEMO' ELSE project_code END,
       scada_drawn    = 'Y',
       last_debug_at  = ISNULL(last_debug_at, SYSDATETIME()),
       asp_user2      = N'system',
       asp_time2      = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND (gateway_id IS NULL
        OR ISNULL(project_code, N'') = N''
        OR ISNULL(scada_drawn,'N') <> 'Y'
        OR last_debug_at IS NULL);
SET @devDone = @@ROWCOUNT;

/* ---------- ③ 采集点:每台补 1 个(没有才补) ---------- */
INSERT INTO dbo.bs_dc_point (device_id, code, name, data_type, unit, addr, freq_seconds, low_limit, high_limit,
                             sort_no, enabled, remark, asp_user1, asp_time1)
SELECT d.id, N'P01', N'运行状态', N'数值', NULL, NULL, 60, NULL, NULL, 1, 'Y',
       N'2026-10-20 migrate-dc-test-ready 自动补:演示用采集点,不影响真实上报',
       N'system', SYSDATETIME()
  FROM dbo.bs_dc_device d
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.bs_dc_point p
                    WHERE p.device_id = d.id AND ISNULL(p.asp_cancel,'N') <> 'Y');

/* ---------- ④ 数采规则:每台补 1 条启用规则(没有才补) ---------- */
INSERT INTO dbo.bs_dc_rule (device_id, name, rule_type, expression, params, enabled, remark,
                            asp_user1, asp_time1)
SELECT d.id, N'越限报警（演示）', N'越限报警', N'value > 100000', NULL, 'Y',
       N'2026-10-20 migrate-dc-test-ready 自动补:阈值取得足够大,演示不会产生报警',
       N'system', SYSDATETIME()
  FROM dbo.bs_dc_device d
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
   AND NOT EXISTS (SELECT 1 FROM dbo.bs_dc_rule r
                    WHERE r.device_id = d.id AND ISNULL(r.asp_cancel,'N') <> 'Y' AND r.enabled = 'Y');

/* ---------- ⑤ 自检:五连必须全齐 ---------- */
DECLARE @total   int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @ready   int = (SELECT COUNT(*) FROM dbo.bs_dc_device d
                         WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
                           AND d.gateway_id IS NOT NULL
                           AND ISNULL(d.project_code, N'') <> N''
                           AND ISNULL(d.scada_drawn,'N') = 'Y'
                           AND d.last_debug_at IS NOT NULL
                           AND EXISTS (SELECT 1 FROM dbo.bs_dc_rule r
                                        WHERE r.device_id = d.id AND ISNULL(r.asp_cancel,'N') <> 'Y'
                                          AND r.enabled = 'Y'));
DECLARE @points  int = (SELECT COUNT(*) FROM dbo.bs_dc_point WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @rules   int = (SELECT COUNT(*) FROM dbo.bs_dc_rule WHERE ISNULL(asp_cancel,'N') <> 'Y' AND enabled = 'Y');
PRINT N'[CHECK] 设备 ' + CAST(@total AS nvarchar(10)) + N' 台 / 五连齐备 ' + CAST(@ready AS nvarchar(10))
      + N' 台 / 采集点 ' + CAST(@points AS nvarchar(10)) + N' 个 / 启用规则 ' + CAST(@rules AS nvarchar(10))
      + N' 条 / 本轮更新设备 ' + CAST(@devDone AS nvarchar(10)) + N' 台';
IF @ready < @total
  RAISERROR(N'[FAIL] 仍有设备五连未齐,请看上面计数', 16, 1);
PRINT N'[PASS] migrate-dc-test-ready-20261020.sql 执行完成';
GO
