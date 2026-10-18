/* ============================================================
   migrate-dc-platform-20261018.sql
   数采平台(设备数据采集)建表 — bs_dc_* 7 张 + 中文注明 + 首批设备台账

   用户口径(m01186)：
   "现在要在系统里面加入数采平台管理模块，方便后续的硬件接入，现在有一个确定的设备是电子秤，
    还可以先补充一些看板，扫码枪这些设备进去"，三个功能：
     1) 设备配置管理 —— 是否绑定网关 / 是否配置数采工程 / 是否绘制组态 / 是否配置数采规则 /
        是否进行数据调试，做统计和提示
     2) 数据监控 —— 实时数据 + 报警数据
     3) 状态统计 —— 在线率、在线/离线数量

   为什么这样建表：
   - 表前缀只能用 DbNormAudit 白名单(yj_/bs_/bd_/bl_/rd_/qc_/wo_)内的，选 bs_ 前缀(基础设置/设备)，
     故全部表名形如 bs_dc_*；带 bs_ 前缀即必须满足体检 04 项：主键 + asp_user1/2 + asp_time1/2。
   - 列名用英文小写 snake_case(便于 Java 侧直接映射)，每张表、每个 ASCII 列都写 MS_Description
     中文注明(体检 02/03 项)。
   - 设备台账与采集数据分离：bs_dc_device 是台账，bs_dc_sample 是流水(只增不改)，
     bs_dc_alarm 是报警工单，bs_dc_status_log 是在线状态变更日志(状态统计的在线率来自它)。

   数据真实性口径(沿用用户 m00994「看板的数据要是系统里面的真实的数据」)：
   - 本脚本**只登记真实存在的设备台账**(电子秤 / 扫码枪 / 车间看板 各 1 台)，
     不造任何采样值、不造报警记录 —— 未接入硬件前，页面如实显示「离线 / 待配置」。
   - 采集数据只能由硬件网关经 POST /api/dc/ingest(或 /api/dc/heartbeat)写入。
   - 需要在演示环境看数据流动时，用 tools/archive/_dc-ingest/ 下的模拟上报脚本(明确标注 demo)。

   幂等：全部 IF OBJECT_ID(...) IS NULL 建表、索引/扩展属性均判存在；
         种子设备按 code 判重，不覆盖人工改过的台账。
   顺序：本脚本已追加到 tools/db-migrations.txt 末尾；两个账套都要执行(正式 HSDZ_MES 先，测试 HSDZ_MES_TEST 后)。
   ============================================================ */
SET NOCOUNT ON;
GO
IF DB_NAME() = N'master' USE HSDZ_MES;
GO

/* ---------- 1. 数采网关 ---------- */
IF OBJECT_ID('dbo.bs_dc_gateway','U') IS NULL
CREATE TABLE dbo.bs_dc_gateway (
  id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_gateway PRIMARY KEY,
  code          nvarchar(50)  NOT NULL,
  name          nvarchar(100) NOT NULL,
  protocol      nvarchar(20)  NULL DEFAULT (N'MQTT'),
  host          nvarchar(100) NULL,
  port          int           NULL,
  status        nvarchar(20)  NULL DEFAULT (N'offline'),
  last_seen_at  datetime2     NULL,
  enabled       char(1)       NOT NULL DEFAULT ('Y'),
  remark        nvarchar(500) NULL,
  asp_user1     nvarchar(50)  NULL,
  asp_time1     datetime2     NULL,
  asp_user2     nvarchar(50)  NULL,
  asp_time2     datetime2     NULL,
  asp_cancel    char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_bs_dc_gateway_code' AND object_id = OBJECT_ID('dbo.bs_dc_gateway'))
  CREATE UNIQUE INDEX UX_bs_dc_gateway_code ON dbo.bs_dc_gateway(code);
GO

/* ---------- 2. 数采设备台账 ---------- */
IF OBJECT_ID('dbo.bs_dc_device','U') IS NULL
CREATE TABLE dbo.bs_dc_device (
  id                int IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_device PRIMARY KEY,
  code              nvarchar(50)  NOT NULL,
  name              nvarchar(100) NOT NULL,
  device_type       nvarchar(20)  NOT NULL,
  model             nvarchar(100) NULL,
  serial_no         nvarchar(100) NULL,
  gateway_id        int           NULL,
  ip                nvarchar(50)  NULL,
  port              int           NULL,
  protocol          nvarchar(20)  NULL,
  workshop          nvarchar(100) NULL,
  project_code      nvarchar(50)  NULL,
  scada_drawn       char(1)       NOT NULL DEFAULT ('N'),
  last_debug_at     datetime2     NULL,
  heartbeat_seconds int           NOT NULL DEFAULT (60),
  status            nvarchar(20)  NULL DEFAULT (N'offline'),
  last_seen_at      datetime2     NULL,
  enabled           char(1)       NOT NULL DEFAULT ('Y'),
  remark            nvarchar(500) NULL,
  asp_user1         nvarchar(50)  NULL,
  asp_time1         datetime2     NULL,
  asp_user2         nvarchar(50)  NULL,
  asp_time2         datetime2     NULL,
  asp_cancel        char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_bs_dc_device_code' AND object_id = OBJECT_ID('dbo.bs_dc_device'))
  CREATE UNIQUE INDEX UX_bs_dc_device_code ON dbo.bs_dc_device(code);
GO

/* ---------- 3. 采集点(变量) ---------- */
IF OBJECT_ID('dbo.bs_dc_point','U') IS NULL
CREATE TABLE dbo.bs_dc_point (
  id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_point PRIMARY KEY,
  device_id     int           NOT NULL,
  code          nvarchar(50)  NOT NULL,
  name          nvarchar(100) NOT NULL,
  data_type     nvarchar(20)  NOT NULL DEFAULT (N'数值'),
  unit          nvarchar(20)  NULL,
  addr          nvarchar(100) NULL,
  freq_seconds  int           NOT NULL DEFAULT (5),
  low_limit     decimal(18,4) NULL,
  high_limit    decimal(18,4) NULL,
  sort_no       int           NOT NULL DEFAULT (0),
  enabled       char(1)       NOT NULL DEFAULT ('Y'),
  remark        nvarchar(500) NULL,
  asp_user1     nvarchar(50)  NULL,
  asp_time1     datetime2     NULL,
  asp_user2     nvarchar(50)  NULL,
  asp_time2     datetime2     NULL,
  asp_cancel    char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bs_dc_point_device' AND object_id = OBJECT_ID('dbo.bs_dc_point'))
  CREATE INDEX IX_bs_dc_point_device ON dbo.bs_dc_point(device_id);
GO

/* ---------- 4. 数采规则 ---------- */
IF OBJECT_ID('dbo.bs_dc_rule','U') IS NULL
CREATE TABLE dbo.bs_dc_rule (
  id            int IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_rule PRIMARY KEY,
  device_id     int           NOT NULL,
  name          nvarchar(100) NOT NULL,
  rule_type     nvarchar(20)  NOT NULL DEFAULT (N'定时采集'),
  expression    nvarchar(200) NULL,
  params        nvarchar(500) NULL,
  enabled       char(1)       NOT NULL DEFAULT ('Y'),
  remark        nvarchar(500) NULL,
  asp_user1     nvarchar(50)  NULL,
  asp_time1     datetime2     NULL,
  asp_user2     nvarchar(50)  NULL,
  asp_time2     datetime2     NULL,
  asp_cancel    char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bs_dc_rule_device' AND object_id = OBJECT_ID('dbo.bs_dc_rule'))
  CREATE INDEX IX_bs_dc_rule_device ON dbo.bs_dc_rule(device_id);
GO

/* ---------- 5. 采集数据流水 ---------- */
IF OBJECT_ID('dbo.bs_dc_sample','U') IS NULL
CREATE TABLE dbo.bs_dc_sample (
  id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_sample PRIMARY KEY,
  device_id     int           NOT NULL,
  point_id      int           NOT NULL,
  value_num     decimal(18,4) NULL,
  value_text    nvarchar(200) NULL,
  quality       char(1)       NOT NULL DEFAULT ('G'),
  collect_at    datetime2     NOT NULL,
  asp_user1     nvarchar(50)  NULL,
  asp_time1     datetime2     NULL,
  asp_user2     nvarchar(50)  NULL,
  asp_time2     datetime2     NULL,
  asp_cancel    char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bs_dc_sample_point_at' AND object_id = OBJECT_ID('dbo.bs_dc_sample'))
  CREATE INDEX IX_bs_dc_sample_point_at ON dbo.bs_dc_sample(point_id, collect_at DESC);
GO

/* ---------- 6. 报警记录 ---------- */
IF OBJECT_ID('dbo.bs_dc_alarm','U') IS NULL
CREATE TABLE dbo.bs_dc_alarm (
  id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_alarm PRIMARY KEY,
  device_id     int           NOT NULL,
  point_id      int           NULL,
  level         nvarchar(20)  NOT NULL DEFAULT (N'提示'),
  message       nvarchar(500) NOT NULL,
  value_text    nvarchar(200) NULL,
  occur_at      datetime2     NOT NULL,
  state         nvarchar(20)  NOT NULL DEFAULT (N'未处理'),
  handled_by    nvarchar(50)  NULL,
  handled_at    datetime2     NULL,
  handled_note  nvarchar(500) NULL,
  asp_user1     nvarchar(50)  NULL,
  asp_time1     datetime2     NULL,
  asp_user2     nvarchar(50)  NULL,
  asp_time2     datetime2     NULL,
  asp_cancel    char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bs_dc_alarm_state_at' AND object_id = OBJECT_ID('dbo.bs_dc_alarm'))
  CREATE INDEX IX_bs_dc_alarm_state_at ON dbo.bs_dc_alarm(state, occur_at DESC);
GO

/* ---------- 7. 在线状态变更日志(状态统计依据) ---------- */
IF OBJECT_ID('dbo.bs_dc_status_log','U') IS NULL
CREATE TABLE dbo.bs_dc_status_log (
  id            bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_bs_dc_status_log PRIMARY KEY,
  device_id     int           NOT NULL,
  status        nvarchar(20)  NOT NULL,
  changed_at    datetime2     NOT NULL,
  reason        nvarchar(200) NULL,
  asp_user1     nvarchar(50)  NULL,
  asp_time1     datetime2     NULL,
  asp_user2     nvarchar(50)  NULL,
  asp_time2     datetime2     NULL,
  asp_cancel    char(1)       NULL DEFAULT ('N')
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_bs_dc_status_log_device_at' AND object_id = OBJECT_ID('dbo.bs_dc_status_log'))
  CREATE INDEX IX_bs_dc_status_log_device_at ON dbo.bs_dc_status_log(device_id, changed_at DESC);
GO

/* ---------- 中文注明(表级 + 列级，幂等) ---------- */
DECLARE @tb TABLE (tbl sysname PRIMARY KEY, descr nvarchar(200));
INSERT INTO @tb (tbl, descr) VALUES
 (N'bs_dc_gateway',    N'数采网关:硬件数据采集网关台账(协议/地址/在线状态)'),
 (N'bs_dc_device',     N'数采设备台账:电子秤/扫码枪/看板/PLC 等设备的配置与接入状态'),
 (N'bs_dc_point',      N'数采采集点:设备下的采集变量(寄存器/端口/单位/量程)'),
 (N'bs_dc_rule',       N'数采规则:定时采集/变化上报/阈值报警规则'),
 (N'bs_dc_sample',     N'数采采集流水:网关上报的实时数据(只增不改)'),
 (N'bs_dc_alarm',      N'数采报警记录:阈值超限等报警及处理留痕'),
 (N'bs_dc_status_log', N'数采在线状态日志:设备在线/离线状态变更,状态统计据此算在线率');
DECLARE @t sysname, @d nvarchar(200);
DECLARE cur1 CURSOR FAST_FORWARD LOCAL FOR SELECT tbl, descr FROM @tb;
OPEN cur1; FETCH NEXT FROM cur1 INTO @t, @d;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
                 WHERE major_id = OBJECT_ID('dbo.' + @t) AND minor_id = 0 AND name = N'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', @d, N'SCHEMA', N'dbo', N'TABLE', @t;
  FETCH NEXT FROM cur1 INTO @t, @d;
END
CLOSE cur1; DEALLOCATE cur1;
GO

DECLARE @c TABLE (tbl sysname, col sysname, descr nvarchar(200));
INSERT INTO @c (tbl, col, descr) VALUES
 (N'bs_dc_gateway', N'code',           N'网关编码'),
 (N'bs_dc_gateway', N'name',           N'网关名称'),
 (N'bs_dc_gateway', N'protocol',       N'通讯协议(MQTT/TCP/HTTP/Modbus)'),
 (N'bs_dc_gateway', N'host',           N'网关地址(IP 或域名)'),
 (N'bs_dc_gateway', N'port',           N'网关端口'),
 (N'bs_dc_gateway', N'status',         N'在线状态(online/offline)'),
 (N'bs_dc_gateway', N'last_seen_at',   N'最近心跳时间'),
 (N'bs_dc_gateway', N'enabled',        N'是否启用(Y/N)'),
 (N'bs_dc_gateway', N'remark',         N'备注'),
 (N'bs_dc_device',  N'code',           N'设备编码'),
 (N'bs_dc_device',  N'name',           N'设备名称'),
 (N'bs_dc_device',  N'device_type',    N'设备类型(电子秤/扫码枪/看板/PLC/其他)'),
 (N'bs_dc_device',  N'model',          N'规格型号'),
 (N'bs_dc_device',  N'serial_no',      N'出厂序列号'),
 (N'bs_dc_device',  N'gateway_id',     N'所属网关(空=未绑定网关)'),
 (N'bs_dc_device',  N'ip',             N'设备 IP'),
 (N'bs_dc_device',  N'port',           N'设备端口'),
 (N'bs_dc_device',  N'protocol',       N'设备通讯协议'),
 (N'bs_dc_device',  N'workshop',       N'所在车间/工位'),
 (N'bs_dc_device',  N'project_code',   N'数采工程编号(空=未配置数采工程)'),
 (N'bs_dc_device',  N'scada_drawn',    N'是否已绘制组态(Y/N)'),
 (N'bs_dc_device',  N'last_debug_at',  N'最近数据调试时间(空=未做数据调试)'),
 (N'bs_dc_device',  N'heartbeat_seconds', N'心跳周期(秒),离线判定=该值*3'),
 (N'bs_dc_device',  N'status',         N'在线状态(online/offline)'),
 (N'bs_dc_device',  N'last_seen_at',   N'最近一次数据上报时间'),
 (N'bs_dc_device',  N'enabled',        N'是否启用(Y/N)'),
 (N'bs_dc_device',  N'remark',         N'备注'),
 (N'bs_dc_point',   N'device_id',      N'所属设备'),
 (N'bs_dc_point',   N'code',           N'采集点编码(网关上报时使用)'),
 (N'bs_dc_point',   N'name',           N'采集点名称'),
 (N'bs_dc_point',   N'data_type',      N'数据类型(数值/开关/文本)'),
 (N'bs_dc_point',   N'unit',           N'计量单位'),
 (N'bs_dc_point',   N'addr',           N'采集地址(寄存器地址或端口)'),
 (N'bs_dc_point',   N'freq_seconds',   N'采集周期(秒)'),
 (N'bs_dc_point',   N'low_limit',      N'下限(低于则报警)'),
 (N'bs_dc_point',   N'high_limit',     N'上限(高于则报警)'),
 (N'bs_dc_point',   N'sort_no',        N'排序号'),
 (N'bs_dc_point',   N'enabled',        N'是否启用(Y/N)'),
 (N'bs_dc_point',   N'remark',         N'备注'),
 (N'bs_dc_rule',    N'device_id',      N'所属设备'),
 (N'bs_dc_rule',    N'name',           N'规则名称'),
 (N'bs_dc_rule',    N'rule_type',      N'规则类型(定时采集/变化上报/阈值报警)'),
 (N'bs_dc_rule',    N'expression',     N'规则表达式'),
 (N'bs_dc_rule',    N'params',         N'规则参数(JSON)'),
 (N'bs_dc_rule',    N'enabled',        N'是否启用(Y/N)'),
 (N'bs_dc_rule',    N'remark',         N'备注'),
 (N'bs_dc_sample',  N'device_id',      N'所属设备'),
 (N'bs_dc_sample',  N'point_id',       N'所属采集点'),
 (N'bs_dc_sample',  N'value_num',      N'数值型采集值'),
 (N'bs_dc_sample',  N'value_text',     N'文本型采集值'),
 (N'bs_dc_sample',  N'quality',        N'数据质量(G良好/B异常)'),
 (N'bs_dc_sample',  N'collect_at',     N'采集时间'),
 (N'bs_dc_alarm',   N'device_id',      N'所属设备'),
 (N'bs_dc_alarm',   N'point_id',       N'所属采集点'),
 (N'bs_dc_alarm',   N'level',          N'报警级别(提示/警告/严重)'),
 (N'bs_dc_alarm',   N'message',        N'报警内容'),
 (N'bs_dc_alarm',   N'value_text',     N'触发报警时的采集值'),
 (N'bs_dc_alarm',   N'occur_at',       N'报警发生时间'),
 (N'bs_dc_alarm',   N'state',          N'处理状态(未处理/已处理)'),
 (N'bs_dc_alarm',   N'handled_by',     N'处理人'),
 (N'bs_dc_alarm',   N'handled_at',     N'处理时间'),
 (N'bs_dc_alarm',   N'handled_note',   N'处理说明'),
 (N'bs_dc_status_log', N'device_id',   N'所属设备'),
 (N'bs_dc_status_log', N'status',      N'状态(online/offline)'),
 (N'bs_dc_status_log', N'changed_at',  N'状态变更时间'),
 (N'bs_dc_status_log', N'reason',      N'变更原因(心跳/数据上报/超时离线)');
DECLARE @ct sysname, @cc sysname, @cd nvarchar(200);
DECLARE cur2 CURSOR FAST_FORWARD LOCAL FOR SELECT tbl, col, descr FROM @c;
OPEN cur2; FETCH NEXT FROM cur2 INTO @ct, @cc, @cd;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                 JOIN sys.columns cl ON cl.object_id = ep.major_id AND cl.column_id = ep.minor_id
                 WHERE ep.major_id = OBJECT_ID('dbo.' + @ct) AND ep.name = N'MS_Description' AND cl.name = @cc)
    EXEC sp_addextendedproperty N'MS_Description', @cd, N'SCHEMA', N'dbo', N'TABLE', @ct, N'COLUMN', @cc;
  FETCH NEXT FROM cur2 INTO @ct, @cc, @cd;
END
CLOSE cur2; DEALLOCATE cur2;
GO

/* ---------- 首批设备台账(真实存在,未接入硬件) ---------- */
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'DZ-001')
INSERT INTO dbo.bs_dc_device (code, name, device_type, model, workshop, enabled, status, heartbeat_seconds, remark, asp_user1, asp_time1)
VALUES (N'DZ-001', N'电子秤', N'电子秤', NULL, NULL, 'Y', N'offline', 60,
        N'首批登记:电子秤(确定要接入的设备),硬件未接入,待绑定网关', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'FX-001')
INSERT INTO dbo.bs_dc_device (code, name, device_type, model, workshop, enabled, status, heartbeat_seconds, remark, asp_user1, asp_time1)
VALUES (N'FX-001', N'扫码枪', N'扫码枪', NULL, NULL, 'Y', N'offline', 60,
        N'首批登记:扫码枪,硬件未接入,待绑定网关', N'migration', SYSDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.bs_dc_device WHERE code = N'KB-001')
INSERT INTO dbo.bs_dc_device (code, name, device_type, model, workshop, enabled, status, heartbeat_seconds, remark, asp_user1, asp_time1)
VALUES (N'KB-001', N'车间看板', N'看板', NULL, NULL, 'Y', N'offline', 60,
        N'首批登记:车间看板,硬件未接入,待绑定网关', N'migration', SYSDATETIME());
GO

/* ---------- 自检 ---------- */
DECLARE @n int = 0;
SELECT @n = @n + 1 FROM sys.objects WHERE type = 'U' AND name IN
 (N'bs_dc_gateway', N'bs_dc_device', N'bs_dc_point', N'bs_dc_rule', N'bs_dc_sample', N'bs_dc_alarm', N'bs_dc_status_log');
IF @n <> 7 RAISERROR(N'[FAIL] 数采平台建表只成功 %d/7 张', 16, 1, @n);

DECLARE @noDesc int = 0;
SELECT @noDesc = COUNT(*) FROM sys.columns cl
 JOIN sys.objects o ON o.object_id = cl.object_id
 WHERE o.type = 'U' AND o.name LIKE N'bs_dc_%' AND cl.is_nullable IS NOT NULL
   AND cl.name NOT LIKE 'asp[_]%' AND cl.name <> N'id'
   AND NOT EXISTS (SELECT 1 FROM sys.extended_properties ep
                   WHERE ep.major_id = cl.object_id AND ep.minor_id = cl.column_id AND ep.name = N'MS_Description');
IF @noDesc <> 0 RAISERROR(N'[FAIL] 数采平台仍有 %d 个列缺中文注明', 16, 1, @noDesc);

DECLARE @dev int = (SELECT COUNT(*) FROM dbo.bs_dc_device WHERE ISNULL(asp_cancel,'N') <> 'Y');
DECLARE @smple int = (SELECT COUNT(*) FROM dbo.bs_dc_sample);
PRINT N'[OK] 数采平台建表 7/7，中文注明齐全，设备台账 ' + CAST(@dev AS nvarchar(10)) + N' 台，采集流水 ' + CAST(@smple AS nvarchar(10)) + N' 条(硬件未接入应为 0)';
GO
