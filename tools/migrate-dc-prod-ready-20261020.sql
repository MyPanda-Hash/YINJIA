/* ============================================================
   migrate-dc-prod-ready-20261020.sql
   正式账套(HSDZ_MES):把数采设备配成「五连齐备（可用）」

   用户口径(2026-10-20):
     「现在把真实账套的也全写成可用的形态,实际上有一个电子秤是可用的这个不用管」

   口径:
     · 五连 = 绑定网关 / 数采工程(project_code) / 绘制组态(scada_drawn='Y') /
              数采规则(≥1 条 enabled 的 bs_dc_rule) / 数据调试(last_debug_at 非空);
       另补 1 个采集点(bs_dc_point)让「采集点」列不为 0。
     · **真实电子秤 DZ-001 不动**(用户明确点名):脚本对它只读不写;它的配置已经是齐备+在线。
     · **不伪造在线**:status / last_seen_at 一律不碰(没接硬件就是离线)。
     · 只更新"还缺项"的设备,已齐备的设备一个字段都不写(幂等,可重复跑)。

   ⚠ 只针对正式账套 HSDZ_MES:闸门放在同一批里(不能插 GO —— T-SQL 的 RETURN 只结束当前批,
     教训见 migrate-dc-device-import-20261019.sql 头注释)。测试账套由
     migrate-dc-test-ready-20261020.sql 单独负责,两边互不干扰。
   ============================================================ */
SET NOCOUNT ON;
GO

IF OBJECT_ID('dbo.bs_dc_device','U') IS NULL OR OBJECT_ID('dbo.bs_dc_gateway','U') IS NULL
BEGIN
  PRINT N'[SKIP] 本库没有数采平台表';
  RETURN;
END
IF DB_NAME() <> N'HSDZ_MES'
BEGIN
  PRINT N'[SKIP] 本脚本只针对正式账套 HSDZ_MES,当前库 = ' + DB_NAME();
  RETURN;
END

/* ---------- ① 兜底网关(已有启用网关就不建) ---------- */
DECLARE @gwId int = (SELECT TOP 1 id FROM dbo.bs_dc_gateway
                      WHERE ISNULL(asp_cancel,'N') <> 'Y' AND enabled = 'Y' ORDER BY id);
IF @gwId IS NULL
BEGIN
  INSERT INTO dbo.bs_dc_gateway (code, name, protocol, host, port, status, enabled, remark,
                                 asp_user1, asp_time1)
  VALUES (N'GW-READY', N'机动网关（配置齐备用）', N'HTTP', N'127.0.0.1', 8090, N'offline', 'Y',
          N'2026-10-20 由 migrate-dc-prod-ready 建:仅用于让台账设备通过「绑定网关」检查',
          N'system', SYSDATETIME());
  SET @gwId = SCOPE_IDENTITY();
END

/* ---------- ② 设备:补网关 / 数采工程 / 组态 / 调试(跳过真实电子秤 DZ-001) ---------- */
DECLARE @devDone int = 0;
UPDATE dbo.bs_dc_device
   SET gateway_id    = ISNULL(gateway_id, @gwId),
       project_code  = CASE WHEN ISNULL(project_code, N'') = N''
                            THEN N'DC-PROJ-' + REPLACE(code, N'-', N'') ELSE project_code END,
       scada_drawn   = 'Y',
       last_debug_at = ISNULL(last_debug_at, SYSDATETIME()),
       asp_user2     = N'system',
       asp_time2     = SYSDATETIME()
 WHERE ISNULL(asp_cancel,'N') <> 'Y'
   AND code <> N'DZ-001'                                  -- 真实电子秤:用户点名不动
   AND (gateway_id IS NULL
        OR ISNULL(project_code, N'') = N''
        OR ISNULL(scada_drawn,'N') <> 'Y'
        OR last_debug_at IS NULL);
SET @devDone = @@ROWCOUNT;

/* ---------- ③ 采集点:缺的补 1 个(DZ-001 有 1 个 W01,不动) ---------- */
INSERT INTO dbo.bs_dc_point (device_id, code, name, data_type, unit, addr, freq_seconds,
                             low_limit, high_limit, sort_no, enabled, remark, asp_user1, asp_time1)
SELECT d.id, N'P01', N'运行状态', N'数值', NULL, NULL, 60, NULL, NULL, 1, 'Y',
       N'2026-10-20 migrate-dc-prod-ready 自动补:台账设备演示采集点',
       N'system', SYSDATETIME()
  FROM dbo.bs_dc_device d
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
   AND d.code <> N'DZ-001'
   AND NOT EXISTS (SELECT 1 FROM dbo.bs_dc_point p
                    WHERE p.device_id = d.id AND ISNULL(p.asp_cancel,'N') <> 'Y');

/* ---------- ④ 数采规则:缺的补 1 条(DZ-001 已有 2 条,不动) ---------- */
INSERT INTO dbo.bs_dc_rule (device_id, name, rule_type, expression, params, enabled, remark,
                            asp_user1, asp_time1)
SELECT d.id, N'越限报警（台账演示）', N'越限报警', N'value > 100000', NULL, 'Y',
       N'2026-10-20 migrate-dc-prod-ready 自动补:阈值取得足够大,不产生误报警',
       N'system', SYSDATETIME()
  FROM dbo.bs_dc_device d
 WHERE ISNULL(d.asp_cancel,'N') <> 'Y'
   AND d.code <> N'DZ-001'
   AND NOT EXISTS (SELECT 1 FROM dbo.bs_dc_rule r
                    WHERE r.device_id = d.id AND ISNULL(r.asp_cancel,'N') <> 'Y' AND r.enabled = 'Y');

/* ---------- ⑤ 自检:DZ-001 之外必须全齐;DZ-001 必须保持原状(在线且齐备) ---------- */
DECLARE @total int = (SELECT COUNT(*) FROM dbo.bs_dc_device
                       WHERE ISNULL(asp_cancel,'N') <> 'Y' AND code <> N'DZ-001');
DECLARE @ready int = (SELECT COUNT(*) FROM dbo.bs_dc_device d
                       WHERE ISNULL(d.asp_cancel,'N') <> 'Y' AND d.code <> N'DZ-001'
                         AND d.gateway_id IS NOT NULL
                         AND ISNULL(d.project_code, N'') <> N''
                         AND ISNULL(d.scada_drawn,'N') = 'Y'
                         AND d.last_debug_at IS NOT NULL
                         AND EXISTS (SELECT 1 FROM dbo.bs_dc_rule r
                                      WHERE r.device_id = d.id AND ISNULL(r.asp_cancel,'N') <> 'Y'
                                        AND r.enabled = 'Y'));
DECLARE @dzState nvarchar(200) = (SELECT TOP 1 N'网关=' + CASE WHEN gateway_id IS NULL THEN N'空' ELSE CAST(gateway_id AS nvarchar(10)) END
                                        + N' 组态=' + ISNULL(scada_drawn, N'') + N' 状态=' + ISNULL(status, N'')
                                        + N' 最后心跳=' + ISNULL(CONVERT(nvarchar(19), last_seen_at, 120), N'空')
                                    FROM dbo.bs_dc_device WHERE code = N'DZ-001' AND ISNULL(asp_cancel,'N') <> 'Y');
PRINT N'[CHECK] 台账设备 ' + CAST(@total AS nvarchar(10)) + N' 台 / 五连齐备 ' + CAST(@ready AS nvarchar(10))
      + N' 台 / 本轮更新 ' + CAST(@devDone AS nvarchar(10)) + N' 台';
PRINT N'[KEEP ] DZ-001(真实电子秤,未改动) ' + ISNULL(@dzState, N'(不存在)');
IF @ready < @total
  RAISERROR(N'[FAIL] 仍有台账设备五连未齐', 16, 1);
PRINT N'[PASS] migrate-dc-prod-ready-20261020.sql 执行完成';
GO
